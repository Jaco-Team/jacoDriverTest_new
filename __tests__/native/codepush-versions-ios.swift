import Foundation
import Darwin
import CryptoKit

struct VersionFixture {
  let name: String
  let envelope: Data
  let publicKey: String
  let now: Int64
  let bundle: Data
}

let runtime = CodePushNativeRuntimeContext(appId: "jaco-driver",
  applicationIdentifier: "org.reactjs.native.example.jacoDriverTest", platform: "ios",
  nativeRuntimeId: String(repeating: "b", count: 64), nativeBuild: "26", rnVersion: "0.88.0",
  hermesVersion: "260318099.0.4", bundleFormat: "js")
let input = try String(contentsOfFile: CommandLine.arguments[1], encoding: .utf8)
var fixtures: [String: VersionFixture] = [:]
for line in input.split(separator: "\n") {
  let fields = line.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
  guard fields[1] == "ios" else { continue }
  let name = String(data: Data(base64Encoded: fields[0])!, encoding: .utf8)!
  fixtures[name] = VersionFixture(name: name, envelope: Data(base64Encoded: fields[2])!,
    publicKey: fields[3], now: Int64(fields[4])!, bundle: Data(base64Encoded: fields[7])!)
}
let valid = fixtures["ios/valid"]!
let alternate = fixtures["ios/valid-exact-payload-whitespace"]!
var checks = 0
var failures = 0
func check(_ name: String, _ test: @autoclosure () throws -> Bool) {
  checks += 1
  do {
    if try !test() { failures += 1; print("FAIL iOS versions: " + name) }
  } catch { failures += 1; print("FAIL iOS versions: " + name + " (fixture error)") }
}

func fixture(_ body: (URL) throws -> Void) rethrows {
  let base = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
  let parent = base.appendingPathComponent("ios-versions-" + UUID().uuidString, isDirectory: true)
  try! FileManager.default.createDirectory(at: parent, withIntermediateDirectories: true)
  defer { try? FileManager.default.removeItem(at: parent) }
  try body(parent.appendingPathComponent("codepush", isDirectory: true))
}

func verify(_ bytes: Data, fixture: VersionFixture = valid) throws -> Data {
  try CodePushManifestVerifier.verify(bytes, trustedKeys: ["download-test-key": fixture.publicKey]).get()
}

func store(_ root: URL, context: CodePushNativeRuntimeContext = runtime,
           clock: @escaping () -> TimeInterval = { ProcessInfo.processInfo.systemUptime },
           verifier: ((Data) throws -> Data)? = nil,
           fault: @escaping (String) throws -> Void = { _ in }) -> CodePushVersionStore {
  CodePushVersionStore(rootURL: root, runtime: context, verifyEnvelope: verifier ?? { try verify($0) },
    monotonicSeconds: clock, fault: fault)
}

func runtimeRoot(_ root: URL, id: String = runtime.nativeRuntimeId) -> URL {
  root.appendingPathComponent("v1/" + id, isDirectory: true)
}
func catalogue(_ root: URL, id: String = runtime.nativeRuntimeId) -> URL {
  runtimeRoot(root, id: id).appendingPathComponent("versions.json")
}
func writeJSON(_ value: [String: Any], _ url: URL) throws {
  try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]).write(to: url)
}
func seedCatalogue(_ root: URL, current: [String: String]?, previous: [String: String]? = nil,
                   id: String = runtime.nativeRuntimeId) throws {
  try FileManager.default.createDirectory(at: runtimeRoot(root, id: id), withIntermediateDirectories: true)
  try writeJSON(["schemaVersion": 1, "nativeRuntimeId": id,
    "current": current as Any? ?? NSNull(), "previous": previous as Any? ?? NSNull()], catalogue(root, id: id))
}

/// Fixture-only disk seeding. Production exposes no equivalent promotion API.
func seed(_ root: URL, _ fixture: VersionFixture = valid, body: Data? = nil) throws -> (reference: [String: String], directory: URL) {
  let envelope = try JSONSerialization.jsonObject(with: fixture.envelope) as! [String: String]
  let payload = Data(base64Encoded: envelope["payloadBase64"]!)!
  let value = try JSONSerialization.jsonObject(with: payload) as! [String: Any]
  let package = value["package"] as! [String: Any]
  let hash = package["sha256"] as! String
  let payloadHash = CodePushDownloadManager.sha256(payload)
  let entrypoint = package["entrypoint"] as! String
  let nativeId = value["nativeRuntimeId"] as! String
  let directory = runtimeRoot(root).appendingPathComponent("candidates/" + hash + "-" + payloadHash)
  try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
  try (body ?? fixture.bundle).write(to: directory.appendingPathComponent(entrypoint))
  try fixture.envelope.write(to: directory.appendingPathComponent("manifest.json"))
  try writeJSON(["schemaVersion": 1, "packageId": nativeId + ":" + hash,
    "nativeRuntimeId": nativeId, "packageSha256": hash, "payloadSha256": payloadHash,
    "manifestSequence": value["manifestSequence"]!, "version": value["version"]!,
    "size": package["size"]!, "entrypoint": entrypoint], directory.appendingPathComponent("metadata.json"))
  return (["packageSha256": hash, "payloadSha256": payloadHash], directory)
}

try fixture { root in
  let current = try seed(root)
  let previous = try seed(root, alternate)
  try seedCatalogue(root, current: current.reference, previous: previous.reference)
  let selector = store(root)
  let binding = selector.select()
  check("fatal fixture selects current with previous", binding.source == "current")
  check("fatal current with previous recorded", selector.markFatal(selection: binding, bindingToken: CodePushProcessIdentity.token))
  let after = try JSONSerialization.jsonObject(with: Data(contentsOf: catalogue(root))) as! [String: Any]
  check("fatal previous promoted", (after["current"] as? [String: String]) == previous.reference && after["previous"] is NSNull)
  check("fatal previous starts", selector.select().packageSha256 == previous.reference["packageSha256"]!)
}

try fixture { root in
  let current = try seed(root)
  try seedCatalogue(root, current: current.reference)
  let outside = root.deletingLastPathComponent().appendingPathComponent("fatal-user-data")
  try Data("preserve".utf8).write(to: outside)
  let selector = store(root)
  let binding = selector.select()
  check("fatal fixture selects current", binding.source == "current")
  check("foreign process cannot report fatal", !selector.markFatal(selection: binding, bindingToken: String(repeating: "0", count: 32)))
  check("fatal current recorded", selector.markFatal(selection: binding, bindingToken: CodePushProcessIdentity.token))
  check("fatal current not relaunched", selector.select().source == "embedded")
  let record = try JSONSerialization.jsonObject(with: Data(contentsOf: catalogue(root))) as! [String: Any]
  check("fatal package quarantined", (record["quarantined"] as! [String]).contains(current.reference["packageSha256"]!))
  check("fatal event recorded", (record["lastEvent"] as! [String: Any])["code"] as? String == "fatal_after_confirmation")
  check("stale fatal ignored", !selector.markFatal(selection: binding, bindingToken: CodePushProcessIdentity.token))
  check("fatal leaves user data intact", try Data(contentsOf: outside) == Data("preserve".utf8))
}

try fixture { root in
  let outside = root.deletingLastPathComponent().appendingPathComponent("auth-orders-maps")
  try Data("user data preserved".utf8).write(to: outside)
  let selection = store(root).select()
  check("missing catalogue starts embedded", selection.source == "embedded" && selection.localURL == nil)
  let record = try JSONSerialization.jsonObject(with: Data(contentsOf: catalogue(root))) as! [String: Any]
  check("initial catalogue current is null", record["current"] is NSNull && record["previous"] is NSNull)
  check("initial catalogue runtime identity", record["nativeRuntimeId"] as? String == runtime.nativeRuntimeId)
  check("missing store preserves unrelated data", try String(contentsOf: outside, encoding: .utf8) == "user data preserved")
}

try fixture { root in
  let candidate = try seed(root)
  let selection = store(root).select()
  check("candidate never auto-promoted", selection.source == "embedded")
  check("unreferenced candidate retained", FileManager.default.fileExists(atPath: candidate.directory.path))
  let record = try JSONSerialization.jsonObject(with: Data(contentsOf: catalogue(root))) as! [String: Any]
  check("candidate leaves current null", record["current"] is NSNull)
}

try fixture { root in
  let current = try seed(root)
  try seedCatalogue(root, current: current.reference)
  let before = try Data(contentsOf: catalogue(root))
  let selected = store(root).select()
  check("valid confirmed current selected", selected.source == "current")
  check("current exact entrypoint", selected.localURL == current.directory.appendingPathComponent("main.jsbundle"))
  check("current has identity and version", !selected.packageId.isEmpty && !selected.version.isEmpty)
  check("selection does not rewrite catalogue", try Data(contentsOf: catalogue(root)) == before)
}

try fixture { root in
  let badCurrent = try seed(root, valid, body: Data("bad".utf8))
  let previous = try seed(root, alternate)
  try seedCatalogue(root, current: badCurrent.reference, previous: previous.reference)
  let before = try Data(contentsOf: catalogue(root))
  let selected = store(root).select()
  check("invalid current uses valid previous", selected.source == "previous")
  check("previous exact file", selected.localURL == previous.directory.appendingPathComponent("main.jsbundle"))
  check("file fallback does not promote or rewrite", try Data(contentsOf: catalogue(root)) == before)
}

for name in ["ios/expired", "ios/not-yet-valid", "ios/disabled", "ios/rollout-zero"] {
  try fixture { root in
    let item = fixtures[name]!
    let current = try seed(root, item)
    try seedCatalogue(root, current: current.reference)
    let selected = store(root).select()
    check(name + " confirmed ignores admission controls", selected.source == "current")
    if name == "ios/expired" || name == "ios/not-yet-valid" {
      var rejected = false
      do {
        _ = try CodePushManifestValidator.validate(verify(item.envelope), runtime: runtime, nowMilliseconds: item.now)
      } catch { rejected = true }
      check(name + " downloader admission remains strict", rejected)
    }
  }
}

try fixture { root in
  let current = try seed(root)
  try seedCatalogue(root, current: current.reference)
  try Data("corrupt anti-replay state".utf8).write(to: runtimeRoot(root).appendingPathComponent("watermark.json"))
  check("confirmed current does not depend on replay watermark", store(root).select().source == "current")
  check("startup does not create install ID", !FileManager.default.fileExists(atPath: root.appendingPathComponent("install-id.json").path))
}

for name in ["ios/runtime-mismatch", "ios/native-build-mismatch", "ios/rn-version-mismatch",
             "ios/hermes-version-mismatch", "ios/key-unknown", "ios/signature-invalid", "ios/payload-changed-after-signing"] {
  try fixture { root in
    let current = try seed(root, fixtures[name]!)
    try seedCatalogue(root, current: current.reference)
    check(name + " confirmed rejected", store(root).select().source == "embedded")
  }
}

for damage in ["bundle", "envelope", "metadata", "extra-file", "missing-file"] {
  try fixture { root in
    let current = try seed(root)
    try seedCatalogue(root, current: current.reference)
    switch damage {
    case "bundle": try Data("tampered".utf8).write(to: current.directory.appendingPathComponent("main.jsbundle"))
    case "envelope": try Data("{}".utf8).write(to: current.directory.appendingPathComponent("manifest.json"))
    case "metadata": try Data("{}".utf8).write(to: current.directory.appendingPathComponent("metadata.json"))
    case "extra-file": try Data("preserve".utf8).write(to: current.directory.appendingPathComponent("unknown-user-data"))
    default: try FileManager.default.removeItem(at: current.directory.appendingPathComponent("main.jsbundle"))
    }
    let before = try Data(contentsOf: catalogue(root))
    check(damage + " invalid confirmed falls back embedded", store(root).select().source == "embedded")
    check(damage + " catalogue preserved", try Data(contentsOf: catalogue(root)) == before)
    check(damage + " package directory not deleted", FileManager.default.fileExists(atPath: current.directory.path))
  }
}

for damage in ["symlink-bundle", "hardlink-bundle", "symlink-metadata", "hardlink-metadata",
               "symlink-envelope", "hardlink-envelope", "symlink-candidate", "symlink-parent"] {
  try fixture { root in
    let current = try seed(root)
    try seedCatalogue(root, current: current.reference)
    let outside = root.deletingLastPathComponent().appendingPathComponent("unrelated-file")
    let name = damage.hasSuffix("metadata") ? "metadata.json" : damage.hasSuffix("envelope") ? "manifest.json" : "main.jsbundle"
    let exactValidBytes = try Data(contentsOf: current.directory.appendingPathComponent(name))
    try exactValidBytes.write(to: outside)
    if damage == "symlink-candidate" || damage == "symlink-parent" {
      let original = damage == "symlink-parent" ? current.directory.deletingLastPathComponent() : current.directory
      let moved = root.deletingLastPathComponent().appendingPathComponent("moved-original")
      try FileManager.default.moveItem(at: original, to: moved)
      try FileManager.default.createSymbolicLink(at: original, withDestinationURL: moved)
    } else {
      let target = current.directory.appendingPathComponent(name)
      try FileManager.default.removeItem(at: target)
      if damage.hasPrefix("hardlink-") { try FileManager.default.linkItem(at: outside, to: target) }
      else { try FileManager.default.createSymbolicLink(at: target, withDestinationURL: outside) }
    }
    check(damage + " rejected", store(root).select().source == "embedded")
    check(damage + " exact valid target bytes preserved", try Data(contentsOf: outside) == exactValidBytes)
  }
}

let invalidCatalogues: [(String, ([String: String]) -> Data)] = [
  ("invalid-json", { _ in Data("broken".utf8) }),
  ("invalid-utf8", { _ in Data([0xff]) }),
  ("extra-field", { reference in try! JSONSerialization.data(withJSONObject: ["schemaVersion": 1, "nativeRuntimeId": runtime.nativeRuntimeId, "current": reference, "previous": NSNull(), "extra": true]) }),
  ("duplicate-key", { _ in Data(("{\"schemaVersion\":1,\"\\u0073chemaVersion\":1,\"nativeRuntimeId\":\"" + runtime.nativeRuntimeId + "\",\"current\":null,\"previous\":null}").utf8) }),
  ("runtime-mismatch", { _ in try! JSONSerialization.data(withJSONObject: ["schemaVersion": 1, "nativeRuntimeId": String(repeating: "c", count: 64), "current": NSNull(), "previous": NSNull()]) }),
  ("boolean-schema", { _ in try! JSONSerialization.data(withJSONObject: ["schemaVersion": true, "nativeRuntimeId": runtime.nativeRuntimeId, "current": NSNull(), "previous": NSNull()]) }),
  ("previous-without-current", { reference in try! JSONSerialization.data(withJSONObject: ["schemaVersion": 1, "nativeRuntimeId": runtime.nativeRuntimeId, "current": NSNull(), "previous": reference]) }),
  ("identical-references", { reference in try! JSONSerialization.data(withJSONObject: ["schemaVersion": 1, "nativeRuntimeId": runtime.nativeRuntimeId, "current": reference, "previous": reference]) }),
  ("path-traversal", { _ in try! JSONSerialization.data(withJSONObject: ["schemaVersion": 1, "nativeRuntimeId": runtime.nativeRuntimeId, "current": ["packageSha256": "../../orders", "payloadSha256": String(repeating: "a", count: 64)], "previous": NSNull()]) }),
]
for (name, bytes) in invalidCatalogues {
  try fixture { root in
    let current = try seed(root)
    let bad = bytes(current.reference)
    try bad.write(to: catalogue(root))
    let selected = store(root).select()
    check(name + " catalogue fails closed", selected.source == "embedded" && selected.reason == "state_invalid")
    check(name + " invalid bytes not rewritten", try Data(contentsOf: catalogue(root)) == bad)
  }
}

for linkType in ["symlink", "hardlink"] {
try fixture { root in
  let current = try seed(root)
  try seedCatalogue(root, current: current.reference)
  let actual = catalogue(root)
  let outside = root.deletingLastPathComponent().appendingPathComponent("private-external-state")
  try FileManager.default.moveItem(at: actual, to: outside)
  if linkType == "symlink" { try FileManager.default.createSymbolicLink(at: actual, withDestinationURL: outside) }
  else { try FileManager.default.linkItem(at: outside, to: actual) }
  let before = try Data(contentsOf: outside)
  check("catalogue " + linkType + " rejected", store(root).select().reason == "state_invalid")
  check("catalogue " + linkType + " valid target preserved", try Data(contentsOf: outside) == before)
}
}

try fixture { root in
  let current = try seed(root)
  try seedCatalogue(root, current: current.reference)
  let lock = try CodePushDownloadFiles.openFile(root.appendingPathComponent("manager.lock"), flags: O_RDWR | O_CREAT)
  defer { close(lock) }
  _ = flock(lock, LOCK_EX | LOCK_NB)
  defer { _ = flock(lock, LOCK_UN) }
  let selected = store(root).select()
  check("shared downloader lock busy -> embedded", selected.source == "embedded" && selected.reason == "storage_busy")
}

try fixture { root in
  let current = try seed(root)
  try seedCatalogue(root, current: current.reference)
  let old = try Data(contentsOf: catalogue(root))
  let newRuntime = CodePushNativeRuntimeContext(appId: runtime.appId, applicationIdentifier: runtime.applicationIdentifier,
    platform: runtime.platform, nativeRuntimeId: String(repeating: "c", count: 64), nativeBuild: "27",
    rnVersion: runtime.rnVersion, hermesVersion: runtime.hermesVersion, bundleFormat: runtime.bundleFormat)
  let selected = store(root, context: newRuntime).select()
  check("new native runtime ignores old state", selected.source == "embedded")
  check("new native runtime gets own empty catalogue", FileManager.default.fileExists(atPath: catalogue(root, id: newRuntime.nativeRuntimeId).path))
  check("new native runtime preserves old catalogue", try Data(contentsOf: catalogue(root)) == old)
  check("new native runtime preserves old package", FileManager.default.fileExists(atPath: current.directory.path))
}

for stage in ["before_catalog_write", "before_catalog_rename", "after_catalog_rename"] {
  try fixture { root in
    let selected = store(root, fault: { if $0 == stage { throw CodePushDownloadFailure("io_error") } }).select()
    check(stage + " initialization fails embedded", selected.source == "embedded")
    let exists = FileManager.default.fileExists(atPath: catalogue(root).path)
    check(stage + " atomic catalogue presence", exists == (stage == "after_catalog_rename"))
    let children = try FileManager.default.contentsOfDirectory(atPath: runtimeRoot(root).path)
    check(stage + " own temporary removed", children.allSatisfy { !$0.hasPrefix(".record-") })
    check(stage + " next launch remains embedded", store(root).select().source == "embedded")
  }
}

try fixture { root in
  let injected = Data("foreign catalogue appeared during write".utf8)
  let selected = store(root, fault: { stage in
    if stage == "before_catalog_rename" { try injected.write(to: catalogue(root)) }
  }).select()
  check("exclusive init does not clobber appeared catalogue", selected.source == "embedded")
  check("concurrent catalogue bytes preserved", try Data(contentsOf: catalogue(root)) == injected)
}

try fixture { root in
  let current = try seed(root)
  let previous = try seed(root, alternate)
  try seedCatalogue(root, current: current.reference, previous: previous.reference)
  var tick: TimeInterval = 0
  var verified = 0
  let selected = store(root, clock: { tick }, verifier: { bytes in
    verified += 1
    let payload = try verify(bytes)
    tick = 2
    return payload
  }).select()
  check("1500ms core deadline selects embedded", selected.source == "embedded" && selected.reason == "startup_timeout")
  check("deadline does not hash previous after exhaustion", verified == 1)
}

try fixture { root in
  let current = try seed(root)
  let previous = try seed(root, alternate)
  try seedCatalogue(root, current: current.reference, previous: previous.reference)
  var tick: TimeInterval = 0
  var verified = 0
  let selected = store(root, clock: { tick }, verifier: { _ in
    verified += 1
    if verified == 2 { tick = 2 }
    throw CodePushDownloadFailure("io_error")
  }).select()
  check("late previous verification failure keeps timeout reason",
    selected.source == "embedded" && selected.reason == "startup_timeout")
  check("late previous failure stays within two candidates", verified == 2)
}

try fixture { root in
  let current = try seed(root)
  try seedCatalogue(root, current: current.reference)
  let catalogueBefore = try Data(contentsOf: catalogue(root))
  let bundleBefore = try Data(contentsOf: current.directory.appendingPathComponent("main.jsbundle"))
  let alias = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
    .appendingPathComponent("ios-parent-alias-" + UUID().uuidString)
  try FileManager.default.createSymbolicLink(at: alias, withDestinationURL: root.deletingLastPathComponent())
  defer { try? FileManager.default.removeItem(at: alias) }
  let selected = store(alias.appendingPathComponent("codepush", isDirectory: true)).select()
  check("symlink immediate parent rejects otherwise valid current", selected.source == "embedded")
  check("symlink immediate parent preserves catalogue and bundle",
    try Data(contentsOf: catalogue(root)) == catalogueBefore
      && Data(contentsOf: current.directory.appendingPathComponent("main.jsbundle")) == bundleBefore)
  check("symlink immediate parent does not create updater lock",
    !FileManager.default.fileExists(atPath: root.appendingPathComponent("manager.lock").path))
}

try fixture { root in
  let current = try seed(root)
  try seedCatalogue(root, current: current.reference)
  let cache = CodePushStartupSelectionCache { store(root).select() }
  let first = cache.selection()
  let replacement = try seed(root, alternate)
  try seedCatalogue(root, current: replacement.reference)
  let second = cache.selection()
  check("one process freezes exact selected path", first.source == "current" && first.localURL == second.localURL)
  check("later catalogue changes wait for next process", store(root).select().localURL != first.localURL)
}

fixture { root in
  var calls = 0
  let cache = CodePushStartupSelectionCache { calls += 1; return store(root).select() }
  let debug = cache.selection(enabled: false)
  check("Debug returns embedded", debug.source == "embedded" && debug.reason == "debug")
  check("Debug never invokes storage closure", calls == 0 && !FileManager.default.fileExists(atPath: root.path))
}

fixture { root in
  let release = DispatchSemaphore(value: 0), workerDone = DispatchSemaphore(value: 0)
  let cache = CodePushStartupSelectionCache(waitMilliseconds: 20) {
    _ = release.wait(timeout: .now() + 2)
    defer { workerDone.signal() }
    return store(root).select()
  }
  let before = ProcessInfo.processInfo.systemUptime
  let timedOut = cache.selection()
  let elapsed = ProcessInfo.processInfo.systemUptime - before
  check("outer bounded worker wait", timedOut.reason == "startup_timeout" && elapsed < 1)
  release.signal()
  check("late worker completes", workerDone.wait(timeout: .now() + 2) == .success)
  check("late worker cannot replace frozen embedded", cache.selection().reason == "startup_timeout")
  check("late worker may only initialize null catalogue", store(root).select().source == "embedded")
}

fixture { root in
  let cache = CodePushStartupSelectionCache(monotonicSeconds: { .nan }) { store(root).select() }
  check("invalid monotonic clock fails closed", cache.selection().reason == "startup_timeout")
  check("invalid cache clock does not touch storage", !FileManager.default.fileExists(atPath: root.path))
}

// Lifecycle fixtures use a fresh in-memory key and genuinely different bundles.
let lifecycleKey = P256.Signing.PrivateKey()
let spkiPrefix = Data([0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d,
  0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00])
let lifecyclePublicKey = (spkiPrefix + lifecycleKey.publicKey.x963Representation).base64EncodedString()
let lifecycleProcess = String(repeating: "1", count: 32)
let lifecycleAttempt = String(repeating: "2", count: 32)
func lifecycleFixture(_ name: String, body: String? = nil,
                      mutate: (inout [String: Any]) -> Void = { _ in }) throws -> VersionFixture {
  let envelope = try JSONSerialization.jsonObject(with: valid.envelope) as! [String: String]
  var payload = try JSONSerialization.jsonObject(with: Data(base64Encoded: envelope["payloadBase64"]!)!) as! [String: Any]
  let bundle = Data((body ?? "global.__CODEPUSH_TEST__ = '\(name)';\n").utf8)
  let hash = CodePushDownloadManager.sha256(bundle)
  var package = payload["package"] as! [String: Any]
  package["sha256"] = hash; package["size"] = bundle.count
  package["url"] = "https://storage.yandexcloud.net/jaco-driver-codepush/ios/" + runtime.nativeRuntimeId + "/releases/" + hash + ".jsbundle"
  payload["package"] = package
  payload["version"] = name
  mutate(&payload)
  let bytes = try JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])
  let signature = try lifecycleKey.signature(for: Data("jaco-driver-codepush-manifest-v1\n".utf8) + bytes).derRepresentation
  return VersionFixture(name: name, envelope: try JSONSerialization.data(withJSONObject: [
    "keyId": "download-test-key", "payloadBase64": bytes.base64EncodedString(),
    "signatureBase64": signature.base64EncodedString()], options: [.sortedKeys]),
    publicKey: lifecyclePublicKey, now: valid.now, bundle: bundle)
}
let lifecycleCurrent = try lifecycleFixture("baseline")
let lifecyclePrevious = try lifecycleFixture("previous")
let lifecycleTrial = try lifecycleFixture("candidate")
func lifecycleStore(_ root: URL, process: String = lifecycleProcess,
                    clock: @escaping () -> TimeInterval = { ProcessInfo.processInfo.systemUptime },
                    fault: @escaping (String) throws -> Void = { _ in }) -> CodePushVersionStore {
  CodePushVersionStore(rootURL: root, runtime: runtime,
    verifyEnvelope: { try CodePushManifestVerifier.verify($0, trustedKeys: ["download-test-key": lifecyclePublicKey]).get() },
    monotonicSeconds: clock, nowMilliseconds: { valid.now }, processToken: process,
    randomAttemptId: { lifecycleAttempt }, fault: fault)
}
func record(_ root: URL) throws -> [String: Any] {
  try JSONSerialization.jsonObject(with: Data(contentsOf: catalogue(root))) as! [String: Any]
}
func seedPointer(_ root: URL, _ item: VersionFixture = lifecycleTrial) throws -> [String: String] {
  let candidate = try seed(root, item)
  let payload = try CodePushManifestVerifier.verify(item.envelope, trustedKeys: ["download-test-key": lifecyclePublicKey]).get()
  let value = try JSONSerialization.jsonObject(with: payload) as! [String: Any]
  try writeJSON(candidate.reference, runtimeRoot(root).appendingPathComponent("candidate.json"))
  try writeJSON(["schemaVersion": 1, "manifestSequence": value["manifestSequence"]!,
    "payloadSha256": candidate.reference["payloadSha256"]!], runtimeRoot(root).appendingPathComponent("watermark.json"))
  try writeJSON(["schemaVersion": 1, "installId": String(repeating: "0", count: 32)], root.appendingPathComponent("install-id.json"))
  return candidate.reference
}
func stateV2(_ root: URL, current: [String: String]?, previous: [String: String]? = nil,
             pending: Any = NSNull(), quarantined: [String] = [], blocked: Bool = false,
             lastEvent: Any = NSNull()) throws {
  try FileManager.default.createDirectory(at: runtimeRoot(root), withIntermediateDirectories: true)
  try writeJSON(["schemaVersion": 2, "nativeRuntimeId": runtime.nativeRuntimeId,
    "current": current as Any? ?? NSNull(), "previous": previous as Any? ?? NSNull(),
    "pending": pending, "quarantined": quarantined, "activationBlocked": blocked,
    "lastEvent": lastEvent], catalogue(root))
}
func pendingRecord(_ candidate: [String: String], fallback: [String: String]? = nil) -> [String: Any] {
  ["attemptId": lifecycleAttempt, "processToken": lifecycleProcess,
    "candidate": candidate, "fallback": fallback as Any? ?? NSNull()]
}

try fixture { root in
  let candidate = try seedPointer(root)
  let selected = lifecycleStore(root).select(allowTrial: true)
  let state = try record(root)
  let pending = state["pending"] as? [String: Any]
  check("ordinary eligible opening selects exact pointer", selected.source == "trial" && selected.reference?.json == candidate)
  check("trial has exact attempt identity", selected.attemptId == lifecycleAttempt && selected.payloadSha256 == candidate["payloadSha256"])
  check("pending schema2 written before returning candidate", state["schemaVersion"] as? Int == 2 && pending?["attemptId"] as? String == selected.attemptId)
  check("pending process token is native binding", pending?["processToken"] as? String == lifecycleProcess)
  check("trial leaves current and previous embedded", state["current"] is NSNull && state["previous"] is NSNull && pending?["fallback"] is NSNull)
  check("v2 exact root fields", Set(state.keys) == Set(["schemaVersion", "nativeRuntimeId", "current", "previous", "pending", "quarantined", "activationBlocked", "lastEvent"]))
  check("trial returns existing immutable candidate path", selected.localURL?.lastPathComponent == "main.jsbundle")
  let next = lifecycleStore(root, process: String(repeating: "3", count: 32)).select(allowTrial: true)
  let recovered = try record(root)
  check("next process never retries unconfirmed pending", next.source == "embedded" && next.reason == "launch_unconfirmed")
  check("pending cleared durably on recovery", recovered["pending"] is NSNull)
  check("unconfirmed quarantine is bundle SHA", recovered["quarantined"] as? [String] == [candidate["packageSha256"]!])
  check("unconfirmed event does not claim crash", (recovered["lastEvent"] as? [String: String])?["code"] == "launch_unconfirmed")
  check("quarantine prevents later eligible trial", lifecycleStore(root).select(allowTrial: true).source == "embedded")
  let newMetadata = try lifecycleFixture("same-bundle-new-metadata", body: String(data: lifecycleTrial.bundle, encoding: .utf8))
  _ = try seedPointer(root, newMetadata)
  check("new signed payload cannot bypass bundle quarantine", lifecycleStore(root).select(allowTrial: true).source == "embedded")
  check("old attempt cannot confirm recovered state", lifecycleStore(root).confirm(selection: selected,
    attemptId: selected.attemptId, processToken: lifecycleProcess).errorCode == "activation_blocked")
}

try fixture { root in
  _ = try seedPointer(root)
  check("background/default selection never starts trial", lifecycleStore(root).select().source == "embedded")
  check("background selection does not consume candidate", (try record(root))["schemaVersion"] as? Int == 1)
  check("later actual ordinary process may select candidate", lifecycleStore(root).select(allowTrial: true).source == "trial")
}

try fixture { root in
  let old = try seed(root, lifecycleCurrent)
  try seedCatalogue(root, current: old.reference)
  let candidate = try seedPointer(root)
  let updater = lifecycleStore(root)
  let trial = updater.select(allowTrial: true)
  check("pending fallback is actual verified current", ((try record(root))["pending"] as? [String: Any])?["fallback"] as? [String: String] == old.reference)
  let before = try Data(contentsOf: catalogue(root))
  check("wrong attempt rejected", updater.confirm(selection: trial, attemptId: String(repeating: "4", count: 32), processToken: lifecycleProcess).errorCode == "confirmation_invalid")
  check("wrong token rejected", updater.confirm(selection: trial, attemptId: trial.attemptId, processToken: String(repeating: "4", count: 32)).errorCode == "confirmation_invalid")
  check("other process rejects old binding", lifecycleStore(root, process: String(repeating: "4", count: 32)).confirm(selection: trial,
    attemptId: trial.attemptId, processToken: lifecycleProcess).errorCode == "confirmation_invalid")
  check("nontrial binding rejected", updater.confirm(selection: .embedded("not trial"), attemptId: trial.attemptId, processToken: lifecycleProcess).errorCode == "confirmation_invalid")
  check("invalid confirmations do not rewrite journal", try Data(contentsOf: catalogue(root)) == before)
  let confirmed = updater.confirm(selection: trial, attemptId: trial.attemptId, processToken: lifecycleProcess)
  let state = try record(root)
  check("successful exact confirmation", confirmed.status == "confirmed" && confirmed.source == "trial" && confirmed.attemptId == trial.attemptId)
  check("native launch result exact7 strings", confirmed.dictionary.count == 7 && Set(confirmed.dictionary.keys) == Set(["status", "errorCode", "packageId", "version", "nativeRuntimeId", "attemptId", "source"]))
  check("confirmed atomically promotes candidate", state["current"] as? [String: String] == candidate && state["previous"] as? [String: String] == old.reference)
  check("confirmed clears pending and records event", state["pending"] is NSNull && (state["lastEvent"] as? [String: String])?["code"] == "confirmed")
  let committed = try Data(contentsOf: catalogue(root))
  check("same successful confirmation is idempotent", updater.confirm(selection: trial, attemptId: trial.attemptId, processToken: lifecycleProcess).status == "confirmed")
  check("idempotent confirmation does not rewrite", try Data(contentsOf: catalogue(root)) == committed)
  check("confirmed next startup is current not another trial", lifecycleStore(root).select(allowTrial: true).source == "current")
  check("confirmed startup has no attempt", lifecycleStore(root).select().attemptId.isEmpty)
}

try fixture { root in
  let bad = try seed(root, lifecycleCurrent, body: Data("corrupt baseline".utf8))
  let good = try seed(root, lifecyclePrevious)
  try seedCatalogue(root, current: bad.reference, previous: good.reference)
  _ = try seedPointer(root)
  let updater = lifecycleStore(root)
  let trial = updater.select(allowTrial: true)
  let pending = (try record(root))["pending"] as? [String: Any]
  check("trial may preserve actual previous fallback", trial.source == "trial" && pending?["fallback"] as? [String: String] == good.reference)
  check("previous fallback trial can confirm", updater.confirm(selection: trial, attemptId: trial.attemptId, processToken: lifecycleProcess).status == "confirmed")
  check("confirmation previous is verified fallback not corrupt current", (try record(root))["previous"] as? [String: String] == good.reference)
}

for stage in ["before_pending_write", "before_pending_rename", "after_pending_rename"] {
  try fixture { root in
    let old = try seed(root, lifecycleCurrent)
    try seedCatalogue(root, current: old.reference)
    let candidate = try seedPointer(root)
    let choice = lifecycleStore(root, fault: { if $0 == stage { throw CodePushDownloadFailure("io_error") } }).select(allowTrial: true)
    check(stage + " never exposes candidate on failed durable write", choice.source == "current")
    check(stage + " leaves confirmed current unchanged", (try record(root))["current"] as? [String: String] == old.reference)
    let pending = (try record(root))["pending"] as? [String: Any]
    check(stage + " unissued pending is removed", pending == nil)
    check(stage + " unused candidate is not quarantined", ((try record(root))["quarantined"] as? [String])?.isEmpty == true)
    let retry = lifecycleStore(root).select(allowTrial: true)
    check(stage + " next startup may retry exact unexecuted candidate", retry.source == "trial" && retry.reference?.json == candidate)
    let children = try FileManager.default.contentsOfDirectory(atPath: runtimeRoot(root).path)
    check(stage + " temporary record cleaned", !children.contains(where: { $0.hasPrefix(".record-") }))
  }
}

for stage in ["before_confirm_write", "before_confirm_rename", "after_confirm_rename"] {
  try fixture { root in
    let old = try seed(root, lifecycleCurrent)
    try seedCatalogue(root, current: old.reference)
    let candidate = try seedPointer(root)
    let trial = lifecycleStore(root).select(allowTrial: true)
    let failing = lifecycleStore(root, fault: { if $0 == stage { throw CodePushDownloadFailure("io_error") } })
    check(stage + " reports confirmation failure", failing.confirm(selection: trial, attemptId: trial.attemptId, processToken: lifecycleProcess).errorCode == "confirmation_failed")
    if stage == "after_confirm_rename" {
      check(stage + " committed confirmation remains idempotent", lifecycleStore(root).confirm(selection: trial, attemptId: trial.attemptId, processToken: lifecycleProcess).status == "confirmed")
      check(stage + " committed current survives", lifecycleStore(root).select().reference?.json == candidate)
    } else {
      check(stage + " old baseline survives next startup", lifecycleStore(root).select(allowTrial: true).reference?.json == old.reference)
      check(stage + " unconfirmed candidate quarantined", (try record(root))["quarantined"] as? [String] == [candidate["packageSha256"]!])
    }
  }
}

for stage in ["before_recovery_write", "before_recovery_rename", "after_recovery_rename"] {
  try fixture { root in
    let old = try seed(root, lifecycleCurrent)
    try seedCatalogue(root, current: old.reference)
    _ = try seedPointer(root)
    _ = lifecycleStore(root).select(allowTrial: true)
    let next = lifecycleStore(root, fault: { if $0 == stage { throw CodePushDownloadFailure("io_error") } }).select(allowTrial: true)
    check(stage + " recovery still uses verified baseline", next.source == "current")
    check(stage + " recovery never starts another trial", next.attemptId.isEmpty)
    check(stage + " later launch still baseline", lifecycleStore(root).select(allowTrial: true).source == "current")
  }
}

try fixture { root in
  let old = try seed(root, lifecycleCurrent)
  let candidate = try seedPointer(root)
  let quarantine = (0..<64).map { String(format: "%064x", $0) }
  try stateV2(root, current: old.reference, pending: pendingRecord(candidate, fallback: old.reference), quarantined: quarantine)
  let next = lifecycleStore(root).select(allowTrial: true)
  let state = try record(root)
  check("quarantine overflow preserves verified baseline", next.source == "current")
  check("quarantine overflow blocks all future activation", state["activationBlocked"] as? Bool == true)
  check("quarantine overflow never evicts earlier failed bundles", state["quarantined"] as? [String] == quarantine)
  _ = try seedPointer(root, lifecyclePrevious)
  check("overflow remains blocked for new candidate", lifecycleStore(root).select(allowTrial: true).source == "current")
}

for scenario in ["missing-pointer", "bad-pointer", "duplicate-pointer", "symlink-pointer", "hardlink-pointer",
                 "missing-watermark", "corrupt-watermark", "newer-sequence", "wrong-payload-watermark", "corrupt-install-id",
                 "disabled", "expired", "rollout-zero", "same-current-bundle", "same-previous-bundle"] {
  try fixture { root in
    let old = try seed(root, lifecycleCurrent)
    let previous = try seed(root, lifecyclePrevious)
    try seedCatalogue(root, current: old.reference, previous: previous.reference)
    var item = lifecycleTrial
    if scenario == "disabled" { item = try lifecycleFixture("disabled", mutate: { $0["enabled"] = false }) }
    if scenario == "expired" { item = try lifecycleFixture("expired", mutate: { $0["expiresAt"] = "2026-10-23T08:59:59.000Z" }) }
    if scenario == "rollout-zero" { item = try lifecycleFixture("zero", mutate: { $0["rolloutBasisPoints"] = 0 }) }
    if scenario == "same-current-bundle" { item = try lifecycleFixture("new-current-payload", body: String(data: lifecycleCurrent.bundle, encoding: .utf8)) }
    if scenario == "same-previous-bundle" { item = try lifecycleFixture("new-previous-payload", body: String(data: lifecyclePrevious.bundle, encoding: .utf8)) }
    let pointer = try seedPointer(root, item)
    let pointerURL = runtimeRoot(root).appendingPathComponent("candidate.json")
    let outside = root.deletingLastPathComponent().appendingPathComponent("external-pointer")
    if scenario == "missing-pointer" { try FileManager.default.removeItem(at: pointerURL) }
    if scenario == "bad-pointer" { try Data("bad".utf8).write(to: pointerURL) }
    if scenario == "duplicate-pointer" { try Data(("{\"packageSha256\":\"" + pointer["packageSha256"]! + "\",\"packageSha256\":\"" + pointer["packageSha256"]! + "\",\"payloadSha256\":\"" + pointer["payloadSha256"]! + "\"}").utf8).write(to: pointerURL) }
    if scenario == "symlink-pointer" || scenario == "hardlink-pointer" {
      try FileManager.default.moveItem(at: pointerURL, to: outside)
      if scenario == "symlink-pointer" { try FileManager.default.createSymbolicLink(at: pointerURL, withDestinationURL: outside) }
      else { try FileManager.default.linkItem(at: outside, to: pointerURL) }
    }
    let watermarkURL = runtimeRoot(root).appendingPathComponent("watermark.json")
    if scenario == "missing-watermark" { try FileManager.default.removeItem(at: watermarkURL) }
    if scenario == "corrupt-watermark" { try Data("bad".utf8).write(to: watermarkURL) }
    if scenario == "newer-sequence" || scenario == "wrong-payload-watermark" {
      let value = try JSONSerialization.jsonObject(with: Data(contentsOf: watermarkURL)) as! [String: Any]
      try writeJSON(["schemaVersion": 1, "manifestSequence": (value["manifestSequence"] as! Int64) + (scenario == "newer-sequence" ? 1 : 0),
        "payloadSha256": scenario == "wrong-payload-watermark" ? String(repeating: "f", count: 64) : pointer["payloadSha256"]!], watermarkURL)
    }
    if scenario == "corrupt-install-id" { try Data("broken".utf8).write(to: root.appendingPathComponent("install-id.json")) }
    let before = try Data(contentsOf: catalogue(root))
    check(scenario + " rejects trial and starts confirmed baseline", lifecycleStore(root).select(allowTrial: true).source == "current")
    check(scenario + " never writes pending", try Data(contentsOf: catalogue(root)) == before)
    if scenario.hasSuffix("-pointer") && scenario.contains("link") {
      check(scenario + " preserves valid external pointer bytes", try Data(contentsOf: outside) == JSONSerialization.data(withJSONObject: pointer, options: [.sortedKeys]))
    }
  }
}

try fixture { root in
  _ = try seedPointer(root)
  let lock = try CodePushDownloadFiles.openFile(root.appendingPathComponent("manager.lock"), flags: O_RDWR | O_CREAT)
  _ = flock(lock, LOCK_EX | LOCK_NB)
  check("lifecycle selection respects downloader lock", lifecycleStore(root).select(allowTrial: true).reason == "storage_busy")
  _ = flock(lock, LOCK_UN); close(lock)
  let trial = lifecycleStore(root).select(allowTrial: true)
  let held = try CodePushDownloadFiles.openFile(root.appendingPathComponent("manager.lock"), flags: O_RDWR)
  _ = flock(held, LOCK_EX | LOCK_NB)
  check("confirmation respects same downloader lock", lifecycleStore(root).confirm(selection: trial, attemptId: trial.attemptId, processToken: lifecycleProcess).errorCode == "lock_busy")
  _ = flock(held, LOCK_UN); close(held)
}

for scenario in ["extra-root", "boolean-schema", "duplicate-quarantine", "overflow-quarantine", "wrong-block-type", "bad-attempt", "extra-pending", "foreign-fallback", "bad-event"] {
  try fixture { root in
    let candidate = try seedPointer(root)
    try stateV2(root, current: nil)
    var value = try record(root)
    switch scenario {
    case "extra-root": value["extra"] = true
    case "boolean-schema": value["schemaVersion"] = true
    case "duplicate-quarantine": value["quarantined"] = [candidate["packageSha256"]!, candidate["packageSha256"]!]
    case "overflow-quarantine": value["quarantined"] = (0..<65).map { String(format: "%064x", $0) }
    case "wrong-block-type": value["activationBlocked"] = 1
    case "bad-attempt": var p = pendingRecord(candidate); p["attemptId"] = "../../x"; value["pending"] = p
    case "extra-pending": var p = pendingRecord(candidate); p["extra"] = true; value["pending"] = p
    case "foreign-fallback": var p = pendingRecord(candidate); p["fallback"] = candidate; value["pending"] = p
    default: value["lastEvent"] = ["code": "crashed", "attemptId": lifecycleAttempt, "packageSha256": candidate["packageSha256"]!]
    }
    try writeJSON(value, catalogue(root))
    let before = try Data(contentsOf: catalogue(root))
    check(scenario + " malformed v2 fails closed", lifecycleStore(root).select(allowTrial: true).reason == "state_invalid")
    check(scenario + " malformed v2 preserved", try Data(contentsOf: catalogue(root)) == before)
  }
}

try fixture { root in
  _ = try seedPointer(root)
  var tick: TimeInterval = 0
  let selection = lifecycleStore(root, clock: { tick }, fault: { if $0 == "after_pending_rename" { tick = 2 } }).select(allowTrial: true)
  let state = try record(root)
  check("deadline after pending prevents exposing candidate", selection.source == "embedded" && selection.reason == "startup_timeout")
  check("deadline after durable pending clears unused attempt", state["pending"] is NSNull
    && state["lastEvent"] is NSNull)
  check("deadline does not quarantine an unexecuted candidate", lifecycleStore(root).select(allowTrial: true).source == "trial")
}

try fixture { root in
  _ = try seedPointer(root)
  let release = DispatchSemaphore(value: 0), done = DispatchSemaphore(value: 0)
  let cache = CodePushStartupSelectionCache(waitMilliseconds: 20, selectWithContext: { context in
    _ = release.wait(timeout: .now() + 2)
    defer { done.signal() }
    let updater = lifecycleStore(root)
    let trial = updater.select(allowTrial: true, activationAllowed: { context.isActive })
    if trial.source == "trial" { context.onDiscardTrial { try? updater.abandonUnissuedTrial(trial) } }
    return trial
  })
  check("outer timeout freezes embedded before trial worker", cache.selection().reason == "startup_timeout")
  release.signal()
  check("late trial worker completes", done.wait(timeout: .now() + 2) == .success)
  check("late pending cannot replace process cached embedded", cache.selection().reason == "startup_timeout")
  check("late cancelled worker leaves candidate eligible for a real opening", lifecycleStore(root).select(allowTrial: true).source == "trial")
}

final class LifecycleTransport: CodePushDownloadTransport {
  let item: VersionFixture
  init(_ item: VersionFixture) { self.item = item }
  func fetch(_ url: String, maxBytes: Int64, timeoutSeconds: TimeInterval,
             consume: @escaping (Data) throws -> Void) throws -> CodePushHTTPResponse {
    let bytes = url.hasSuffix("manifest.json") ? item.envelope : item.bundle
    try consume(bytes)
    return CodePushHTTPResponse(statusCode: 200, contentLength: Int64(bytes.count), finalURL: url, redirected: false)
  }
}
func lifecycleDownloader(_ root: URL, fault: @escaping (String) throws -> Void = { _ in }) -> CodePushDownloadManager {
  var dependencies = CodePushDownloadDependencies(transport: LifecycleTransport(lifecycleTrial))
  dependencies.nowMilliseconds = { valid.now }
  dependencies.freeBytes = { _ in Int64.max }
  dependencies.randomBytes = { Data(repeating: 0, count: 16) }
  dependencies.fault = fault
  return CodePushDownloadManager(rootURL: root, runtime: runtime,
    verifyEnvelope: { try CodePushManifestVerifier.verify($0, trustedKeys: ["download-test-key": lifecyclePublicKey]).get() },
    dependencies: dependencies)
}
try fixture { root in
  let result = lifecycleDownloader(root).checkAndDownload()
  check("downloader commits immutable candidate and exact pointer", result.status == "downloaded")
  let pointerURL = runtimeRoot(root).appendingPathComponent("candidate.json")
  let pointer = try JSONSerialization.jsonObject(with: Data(contentsOf: pointerURL)) as! [String: String]
  check("downloaded pointer shape is exactly two hashes", Set(pointer.keys) == Set(["packageSha256", "payloadSha256"]))
  check("downloaded pointer selects trial on eligible next opening", lifecycleStore(root).select(allowTrial: true).source == "trial")
  try FileManager.default.removeItem(at: pointerURL)
  check("already downloaded verifies before repairing pointer", lifecycleDownloader(root).checkAndDownload().status == "already_downloaded")
  check("already downloaded restores exact pointer", try Data(contentsOf: pointerURL) == JSONSerialization.data(withJSONObject: pointer, options: [.sortedKeys]))
}
for stage in ["before_candidate_pointer_write", "after_candidate_pointer_write"] {
  fixture { root in
    let result = lifecycleDownloader(root, fault: { if $0 == stage { throw CodePushDownloadFailure("io_error") } }).checkAndDownload()
    check(stage + " reports failed publication", result.status == "error")
    let pointer = runtimeRoot(root).appendingPathComponent("candidate.json")
    check(stage + " pointer atomic visibility", FileManager.default.fileExists(atPath: pointer.path) == (stage == "after_candidate_pointer_write"))
    check(stage + " retry reuses verified immutable candidate", lifecycleDownloader(root).checkAndDownload().status == "already_downloaded")
    check(stage + " retry leaves eligible exact pointer", lifecycleStore(root).select(allowTrial: true).source == "trial")
  }
}
try fixture { root in
  _ = try seedPointer(root)
  let trial = lifecycleStore(root).select(allowTrial: true)
  let other = String(repeating: "4", count: 32)
  check("copied trial cannot confirm with new process arguments after success", lifecycleStore(root).confirm(selection: trial, attemptId: trial.attemptId, processToken: lifecycleProcess).status == "confirmed")
  check("idempotence still rejects another process binding", lifecycleStore(root, process: other).confirm(selection: trial, attemptId: trial.attemptId, processToken: other).errorCode == "confirmation_invalid")
}
try fixture { root in
  let old = try seed(root, lifecycleCurrent)
  try seedCatalogue(root, current: old.reference)
  _ = try seedPointer(root)
  var tick: TimeInterval = 0
  let selected = lifecycleStore(root, clock: { tick }, fault: { if $0 == "after_pending_rename" { tick = 2 } }).select(allowTrial: true)
  check("late trial commit preserves already verified baseline", selected.source == "current" && selected.reason == "startup_timeout")
  check("late trial commit never marks candidate healthy", (try record(root))["current"] as? [String: String] == old.reference)
  check("late unused trial commit may be retried next opening", lifecycleStore(root).select(allowTrial: true).source == "trial")
}

fixture { root in
  _ = try? seedPointer(root)
  var observed: [Bool] = []
  let provenance = CodePushStartupProvenance { allowed in
    observed.append(allowed)
    return lifecycleStore(root).select(allowTrial: allowed)
  }
  check("early default request selects embedded", provenance.selection().source == "embedded")
  provenance.markNormalUIStart(true)
  check("late UI provenance cannot grant trial in same process", provenance.selection().source == "embedded" && observed == [false])
}
try fixture { root in
  _ = try seedPointer(root)
  var observed: [Bool] = []
  let provenance = CodePushStartupProvenance { allowed in
    observed.append(allowed)
    return lifecycleStore(root).select(allowTrial: allowed)
  }
  provenance.markNormalUIStart(true)
  let first = provenance.selection()
  provenance.markNormalUIStart(false)
  let second = provenance.selection()
  check("ordinary UI provenance allows exactly one selection", first.source == "trial" && observed == [true])
  check("later background flag never changes running trial binding", first.attemptId == second.attemptId && first.localURL == second.localURL)
}

try fixture { root in
  let candidate = try seedPointer(root)
  let trial = lifecycleStore(root).select(allowTrial: true)
  let before = try Data(contentsOf: catalogue(root))
  check("already invalidated module cannot confirm queued work", lifecycleStore(root).confirm(selection: trial,
    attemptId: trial.attemptId, processToken: lifecycleProcess, bindingValid: { false }).errorCode == "confirmation_invalid")
  check("queued invalidation leaves pending journal unchanged", try Data(contentsOf: catalogue(root)) == before)
  var alive = true
  let updater = lifecycleStore(root, fault: { if $0 == "before_confirm_rename" { alive = false } })
  let result = updater.confirm(selection: trial, attemptId: trial.attemptId, processToken: lifecycleProcess,
    bindingValid: { alive })
  check("invalidation immediately before rename rejects confirmation", result.errorCode == "confirmation_invalid")
  check("invalidation before rename cannot commit healthy proof", try Data(contentsOf: catalogue(root)) == before)
  check("invalidated confirmation removes only owned temporary", !(try FileManager.default.contentsOfDirectory(atPath: runtimeRoot(root).path)).contains(where: { $0.hasPrefix(".record-") }))
  check("unconfirmed invalidated attempt recovers on next opening", lifecycleStore(root).select(allowTrial: true).source == "embedded")
  check("invalidated attempt bundle is quarantined", (try record(root))["quarantined"] as? [String] == [candidate["packageSha256"]!])
}
for scenario in ["blocked", "quarantined"] {
  try fixture { root in
    let candidate = try seedPointer(root)
    let trial = lifecycleStore(root).select(allowTrial: true)
    check(scenario + " fixture first commits valid confirmation", lifecycleStore(root).confirm(selection: trial,
      attemptId: trial.attemptId, processToken: lifecycleProcess).status == "confirmed")
    var state = try record(root)
    if scenario == "blocked" { state["activationBlocked"] = true }
    else { state["quarantined"] = [candidate["packageSha256"]!] }
    try writeJSON(state, catalogue(root))
    let before = try Data(contentsOf: catalogue(root))
    check(scenario + " guard precedes idempotent success", lifecycleStore(root).confirm(selection: trial,
      attemptId: trial.attemptId, processToken: lifecycleProcess).errorCode == "activation_blocked")
    check(scenario + " rejected repeat leaves record unchanged", try Data(contentsOf: catalogue(root)) == before)
  }
}

// Diagnostics observe saved versions without selecting, recovering or creating state.
try fixture { root in
  let parentBefore = try FileManager.default.contentsOfDirectory(atPath: root.deletingLastPathComponent().path)
  let result = lifecycleStore(root).diagnostics()
  check("diagnostics missing store is empty", result.storageStatus == "missing" && result.candidateStatus == "none")
  check("diagnostics never creates missing root or lock", !FileManager.default.fileExists(atPath: root.path))
  check("diagnostics preserves missing parent contents", try FileManager.default.contentsOfDirectory(atPath: root.deletingLastPathComponent().path) == parentBefore)
}
try fixture { root in
  let current = try seed(root, lifecycleCurrent)
  let previous = try seed(root, lifecyclePrevious)
  try seedCatalogue(root, current: current.reference, previous: previous.reference)
  let bound = lifecycleStore(root).select()
  let candidate = try seedPointer(root)
  try stateV2(root, current: current.reference, previous: previous.reference,
    pending: pendingRecord(candidate, fallback: current.reference),
    lastEvent: ["code": "launch_unconfirmed", "attemptId": lifecycleAttempt, "packageSha256": previous.reference["packageSha256"]!])
  let before = try Data(contentsOf: catalogue(root))
  let inputBefore = try Data(contentsOf: runtimeRoot(root).appendingPathComponent("candidate.json"))
  let result = lifecycleStore(root).diagnostics()
  check("diagnostics verifies confirmed current", result.currentPackageId == bound.packageId && result.currentVersion == lifecycleCurrent.name)
  check("diagnostics verifies previous separately", result.previousVersion == lifecyclePrevious.name)
  check("diagnostics verifies exact downloaded pointer", result.candidateStatus == "ready" && result.candidateVersion == lifecycleTrial.name)
  check("diagnostics exposes only strict last event", result.lastEvent == "launch_unconfirmed" && result.lastEventPackageSha256 == previous.reference["packageSha256"])
  check("diagnostics never recovers pending or ACKs", try Data(contentsOf: catalogue(root)) == before)
  check("diagnostics preserves exact candidate pointer", try Data(contentsOf: runtimeRoot(root).appendingPathComponent("candidate.json")) == inputBefore)
  let binding = CodePushLaunchBinding(selection: bound, nativeRuntimeId: runtime.nativeRuntimeId, processToken: lifecycleProcess, errorCode: "")
  let snapshot = CodePushDiagnostics.snapshot(runtime: runtime, binding: binding, confirmed: false, storage: result,
    download: CodePushDownloadHistory().snapshot())
  check("native diagnostics exact24 fields", snapshot.count == 24 && Set(snapshot.keys) == Set([
    "status", "errorCode", "applicationIdentifier", "nativeBuild", "nativeRuntimeId", "source", "launchStatus", "launchReason",
    "launchedPackageId", "launchedVersion", "currentPackageId", "currentVersion", "previousPackageId", "previousVersion",
    "candidatePackageId", "candidateVersion", "candidateStatus", "lastEvent", "lastEventPackageSha256", "downloadStatus",
    "downloadErrorCode", "downloadPackageId", "downloadVersion", "storageStatus"]))
  check("diagnostics native identity comes from context", snapshot["applicationIdentifier"] == runtime.applicationIdentifier && snapshot["nativeBuild"] == runtime.nativeBuild && snapshot["nativeRuntimeId"] == runtime.nativeRuntimeId)
  check("diagnostics launched binding is immutable", snapshot["launchedPackageId"] == bound.packageId && snapshot["source"] == "current" && snapshot["candidatePackageId"] != bound.packageId)
  check("diagnostics exports no paths or process tokens", !snapshot.values.contains(where: { $0.contains(root.path) || $0 == lifecycleProcess }))
}
for scenario in ["expired", "disabled", "quarantined", "bad-watermark"] {
  try fixture { root in
    _ = lifecycleStore(root).select()
    let item = try lifecycleFixture("diagnostic-" + scenario, mutate: {
      if scenario == "expired" { $0["expiresAt"] = "2026-10-23T08:59:59.000Z" }
      if scenario == "disabled" { $0["enabled"] = false }
    })
    let pointer = try seedPointer(root, item)
    if scenario == "quarantined" { try stateV2(root, current: nil, quarantined: [pointer["packageSha256"]!], blocked: true) }
    if scenario == "bad-watermark" { try Data("broken".utf8).write(to: runtimeRoot(root).appendingPathComponent("watermark.json")) }
    let before = try Data(contentsOf: catalogue(root))
    let result = lifecycleStore(root).diagnostics()
    check(scenario + " diagnostic ready means integrity not admission", result.candidateStatus == "ready" && result.candidateVersion == item.name)
    check(scenario + " diagnostic does not rewrite controls", try Data(contentsOf: catalogue(root)) == before)
  }
}
try fixture { root in
  let current = try seed(root, lifecycleCurrent)
  let previous = try seed(root, lifecyclePrevious)
  try seedCatalogue(root, current: current.reference, previous: previous.reference)
  _ = lifecycleStore(root).select()
  _ = try seedPointer(root)
  try Data("corrupt current".utf8).write(to: current.directory.appendingPathComponent("main.jsbundle"))
  let before = try Data(contentsOf: catalogue(root))
  let result = lifecycleStore(root).diagnostics()
  check("diagnostics never labels corrupt current verified", result.currentPackageId.isEmpty && result.storageStatus == "invalid")
  check("diagnostics preserves verified previous with corrupt current", result.previousVersion == lifecyclePrevious.name)
  check("diagnostics still reports independently verified candidate", result.candidateStatus == "ready")
  check("corrupt current diagnostics never promotes previous", try Data(contentsOf: catalogue(root)) == before)
}
for scenario in ["pointer", "bundle", "catalogue"] {
  try fixture { root in
    _ = lifecycleStore(root).select()
    let candidate = try seedPointer(root)
    let directory = runtimeRoot(root).appendingPathComponent("candidates/" + candidate["packageSha256"]! + "-" + candidate["payloadSha256"]!)
    let target = scenario == "pointer" ? runtimeRoot(root).appendingPathComponent("candidate.json")
      : scenario == "bundle" ? directory.appendingPathComponent("main.jsbundle") : catalogue(root)
    try Data("corrupt".utf8).write(to: target)
    let result = lifecycleStore(root).diagnostics()
    if scenario == "catalogue" { check("diagnostics corrupt catalogue fails closed without recovery", result.storageStatus == "invalid" && result.candidateStatus == "ready") }
    else { check(scenario + " diagnostic candidate invalid", result.candidateStatus == "invalid" && result.candidatePackageId.isEmpty) }
    check(scenario + " diagnostic preserves corrupt bytes", try Data(contentsOf: target) == Data("corrupt".utf8))
  }
}
try fixture { root in
  _ = lifecycleStore(root).select()
  let before = try Data(contentsOf: catalogue(root))
  let held = try CodePushDownloadFiles.openFile(root.appendingPathComponent("manager.lock"), flags: O_RDWR)
  _ = flock(held, LOCK_EX | LOCK_NB)
  let result = lifecycleStore(root).diagnostics()
  _ = flock(held, LOCK_UN); close(held)
  check("diagnostics respects downloader/confirmation OS lock", result.storageStatus == "busy" && result.errorCode == "storage_busy")
  check("busy diagnostics never writes journal", try Data(contentsOf: catalogue(root)) == before)
}
try fixture { root in
  _ = try seedPointer(root)
  let trial = lifecycleStore(root).select(allowTrial: true)
  let binding = CodePushLaunchBinding(selection: trial, nativeRuntimeId: runtime.nativeRuntimeId, processToken: lifecycleProcess, errorCode: "")
  _ = lifecycleStore(root).confirm(selection: trial, attemptId: trial.attemptId, processToken: lifecycleProcess)
  let result = CodePushDiagnostics.snapshot(runtime: runtime, binding: binding, confirmed: true,
    storage: lifecycleStore(root).diagnostics(), download: CodePushDownloadHistory.shared.snapshot())
  check("confirmed diagnostics keeps actual trial source", result["source"] == "trial" && result["launchStatus"] == "confirmed")
  check("confirmed diagnostics reports committed current separately", result["currentPackageId"] == trial.packageId && result["launchedPackageId"] == trial.packageId)
}
let observation = CodePushDownloadHistory()
check("download observation initially not checked", observation.snapshot().status == "not_checked")
observation.begin()
check("download observation publishes checking", observation.snapshot().status == "checking")
let observedResult = CodePushDownloadResult(status: "error", errorCode: "hash_mismatch", packageId: "package", version: "v1", nativeRuntimeId: runtime.nativeRuntimeId, packageSha256: String(repeating: "a", count: 64))
observation.finish(observedResult)
check("download observation preserves all fixed result fields", observation.snapshot().errorCode == "hash_mismatch" && observation.snapshot().version == "v1")
let frozenObservation = observation.snapshot()
observation.begin()
check("download observation snapshot is immutable", frozenObservation.status == "error" && observation.snapshot().status == "checking")

for elapsed: TimeInterval in [2, 11] {
  try fixture { root in
    let current = try seed(root, lifecycleCurrent)
    try seedCatalogue(root, current: current.reference)
    _ = lifecycleStore(root).select()
    var tick: TimeInterval = 0
    let store = CodePushVersionStore(rootURL: root, runtime: runtime,
      verifyEnvelope: { bytes in
        let payload = try CodePushManifestVerifier.verify(bytes, trustedKeys: ["download-test-key": lifecyclePublicKey]).get()
        tick = elapsed
        return payload
      }, monotonicSeconds: { tick })
    let result = store.diagnostics()
    if elapsed == 2 { check("diagnostics has separate10second background budget", result.currentVersion == lifecycleCurrent.name && result.storageStatus == "ready") }
    else { check("diagnostics shared10second budget fails bounded", result.errorCode == "diagnostics_timeout" && result.currentPackageId.isEmpty) }
  }
}


// Native preflight: the actual downloader precedes the first RN bundle choice.
final class ColdStartTransport: CodePushDownloadTransport {
  let item: VersionFixture
  var budgets: [TimeInterval] = []
  var beforeFetch: (Int) -> Void = { _ in }
  init(_ item: VersionFixture) { self.item = item }
  func fetch(_ url: String, maxBytes: Int64, timeoutSeconds: TimeInterval,
             consume: @escaping (Data) throws -> Void) throws -> CodePushHTTPResponse {
    budgets.append(timeoutSeconds)
    beforeFetch(budgets.count)
    let bytes = url.hasSuffix("manifest.json") ? item.envelope : item.bundle
    try consume(bytes)
    return CodePushHTTPResponse(statusCode: 200, contentLength: Int64(bytes.count), finalURL: url, redirected: false)
  }
}

try fixture { root in
  let transport = ColdStartTransport(lifecycleTrial)
  let preflight = CodePushColdStartPreflight(baseline: { _ in lifecycleStore(root).select() },
    download: { timeout, context in
      var dependencies = CodePushDownloadDependencies(transport: transport)
      dependencies.nowMilliseconds = { valid.now }
      dependencies.freeBytes = { _ in 1024 * 1024 * 1024 }
      return CodePushDownloadManager(rootURL: root, runtime: runtime,
        verifyEnvelope: { try CodePushManifestVerifier.verify($0, trustedKeys: ["download-test-key": lifecyclePublicKey]).get() },
        dependencies: dependencies).checkAndDownload(timeoutSeconds: timeout)
    })
  let prepared = CodePushStartupSelectionCache(waitMilliseconds: 8000,
    selectWithContext: { preflight.run(context: $0) }).selection()
  let preparedState = try record(root)
  check("preflight downloads before any trial exists", prepared.source == "embedded"
    && preparedState["pending"] == nil && lifecycleStore(root).diagnostics().candidateStatus == "ready")
  check("startup download retains bounded slow-network operation budget", transport.budgets.count == 2
    && transport.budgets.allSatisfy { $0 > 0 && $0 <= 120 })
  let final = CodePushStartupSelectionCache(selectWithContext: { context in
    context.publishBaseline(prepared)
    let updater = lifecycleStore(root)
    let choice = updater.select(allowTrial: true, activationAllowed: { context.isActive })
    if choice.source == "trial" { context.onDiscardTrial { try? updater.abandonUnissuedTrial(choice) } }
    return choice
  }).selection()
  let finalState = try record(root)
  check("newly downloaded bundle runs in this same opening", final.source == "trial"
    && final.version == lifecycleTrial.name && finalState["pending"] is [String: Any])
}

try fixture { root in
  let old = try seed(root, lifecycleCurrent)
  try seedCatalogue(root, current: old.reference)
  _ = try seedPointer(root)
  var calls = 0
  let preflight = CodePushColdStartPreflight(baseline: { _ in lifecycleStore(root).select() },
    download: { _, _ in
      calls += 1
      return CodePushDownloadResult(status: "error", errorCode: "network_timeout", packageId: "",
        version: "", nativeRuntimeId: runtime.nativeRuntimeId, packageSha256: "")
    })
  let baseline = CodePushStartupSelectionCache(waitMilliseconds: 8000,
    selectWithContext: { preflight.run(context: $0) }).selection()
  check("offline completed preflight keeps verified current", calls == 1 && baseline.source == "current")
  check("cached signed candidate remains eligible offline after preflight", lifecycleStore(root).select(allowTrial: true).source == "trial")
}

try fixture { root in
  let candidate = try seedPointer(root)
  try stateV2(root, current: nil, pending: pendingRecord(candidate))
  var downloads = 0
  let preflight = CodePushColdStartPreflight(baseline: { _ in lifecycleStore(root).select() }, download: { _, _ in
    downloads += 1
    return CodePushDownloadResult(status: "downloaded", errorCode: "", packageId: "", version: "",
      nativeRuntimeId: runtime.nativeRuntimeId, packageSha256: "")
  })
  let recovered = CodePushStartupSelectionCache(waitMilliseconds: 8000,
    selectWithContext: { preflight.run(context: $0) }).selection()
  let state = try record(root)
  check("recovery preflight does not replace failed candidate in same opening", recovered.reason == "launch_unconfirmed"
    && downloads == 0 && state["pending"] is NSNull)
}

try fixture { root in
  let old = try seed(root, lifecycleCurrent)
  try seedCatalogue(root, current: old.reference)
  let release = DispatchSemaphore(value: 0), done = DispatchSemaphore(value: 0)
  let transport = ColdStartTransport(lifecycleTrial)
  transport.beforeFetch = { request in if request == 1 { _ = release.wait(timeout: .now() + 2) } }
  let preflight = CodePushColdStartPreflight(baseline: { _ in lifecycleStore(root).select() }, download: { _, _ in
    defer { done.signal() }
    var dependencies = CodePushDownloadDependencies(transport: transport)
    dependencies.nowMilliseconds = { valid.now }
    dependencies.freeBytes = { _ in 1024 * 1024 * 1024 }
    return CodePushDownloadManager(rootURL: root, runtime: runtime,
      verifyEnvelope: { try CodePushManifestVerifier.verify($0, trustedKeys: ["download-test-key": lifecyclePublicKey]).get() },
      dependencies: dependencies).checkAndDownload()
  })
  let cache = CodePushStartupSelectionCache(waitMilliseconds: 100,
    selectWithContext: { preflight.run(context: $0) })
  let fallback = cache.selection()
  check("preflight hard timeout preserves confirmed path", fallback.source == "current"
    && fallback.reference?.json == old.reference && fallback.reason == "startup_timeout" && fallback.attemptId.isEmpty)
  release.signal()
  check("late network worker finishes", done.wait(timeout: .now() + 2) == .success)
  let lateState = try record(root)
  check("late preflight cannot change frozen version", cache.selection().reference?.json == old.reference
    && lateState["pending"] == nil)
  check("late bounded download prepares a candidate without activating it", lifecycleStore(root).diagnostics().candidateStatus == "ready"
    && lateState["pending"] == nil)
  check("warm foreground keeps the frozen baseline", cache.selection().source == "current"
    && cache.selection().reference?.json == old.reference)
  check("next cold opening may try the verified late candidate",
    lifecycleStore(root, process: String(repeating: "3", count: 32)).select(allowTrial: true).source == "trial")
}

try fixture { root in
  _ = try seedPointer(root)
  var active = true
  let updater = lifecycleStore(root, fault: { if $0 == "after_pending_rename" { active = false } })
  let stopped = updater.select(allowTrial: true, activationAllowed: { active })
  let state = try record(root)
  check("global cancellation after durable pending rolls back unused attempt", stopped.reason == "startup_timeout"
    && state["pending"] is NSNull && (state["quarantined"] as? [String])?.isEmpty == true
    && state["lastEvent"] is NSNull)
  check("unused cancelled candidate is not quarantined on next process",
    lifecycleStore(root, process: String(repeating: "3", count: 32)).select(allowTrial: true).source == "trial")
}

try fixture { root in
  let old = try seed(root, lifecycleCurrent)
  try seedCatalogue(root, current: old.reference)
  _ = try seedPointer(root)
  let clockLock = NSLock()
  var tick: TimeInterval = 0
  let clock: () -> TimeInterval = { clockLock.lock(); defer { clockLock.unlock() }; return tick }
  let cleaned = DispatchSemaphore(value: 0)
  let cache = CodePushStartupSelectionCache(waitMilliseconds: 1000, monotonicSeconds: clock,
    selectWithContext: { context in
      context.publishBaseline(lifecycleStore(root).select())
      let updater = lifecycleStore(root)
      let trial = updater.select(allowTrial: true, activationAllowed: { context.isActive })
      if trial.source == "trial" {
        context.onDiscardTrial { try? updater.abandonUnissuedTrial(trial); cleaned.signal() }
      }
      clockLock.lock(); tick = 2; clockLock.unlock()
      return trial
    })
  let fallback = cache.selection()
  check("late completion after trial preparation keeps verified baseline", fallback.source == "current"
    && fallback.reason == "startup_timeout" && fallback.attemptId.isEmpty)
  let cleanupFinished = cleaned.wait(timeout: .now() + 2) == .success
  let state = try record(root)
  check("rejected late trial cleans only its unissued attempt", cleanupFinished
    && state["pending"] is NSNull && state["lastEvent"] is NSNull)
}

try fixture { root in
  _ = try seedPointer(root)
  let updater = lifecycleStore(root)
  let trial = updater.select(allowTrial: true)
  _ = updater.confirm(selection: trial, attemptId: trial.attemptId, processToken: lifecycleProcess)
  try updater.abandonUnissuedTrial(trial)
  let state = try record(root)
  check("unissued cleanup never deletes an acknowledged current", state["current"] as? [String: String] == trial.reference?.json
    && (state["lastEvent"] as? [String: String])?["code"] == "confirmed")
}

check("ordinary foreground metadata allows preflight", CodePushSceneEntryPolicy.isOrdinary(windowApplication: true,
  applicationLaunchKeys: [], hasURL: false, hasUserActivity: false, hasNotification: false, hasShortcut: false))
check("unrelated app options are not mistaken for background provenance", CodePushSceneEntryPolicy.isOrdinary(windowApplication: true,
  applicationLaunchKeys: ["serviceSetting"], hasURL: false, hasUserActivity: false, hasNotification: false, hasShortcut: false))
for key in ["UIApplicationLaunchOptionsURLKey", "UIApplicationLaunchOptionsRemoteNotificationKey",
            "UIApplicationLaunchOptionsLocationKey", "UIApplicationLaunchOptionsBluetoothCentralsKey"] {
  check("external application key disables preflight: " + key, !CodePushSceneEntryPolicy.isOrdinary(windowApplication: true,
    applicationLaunchKeys: [key], hasURL: false, hasUserActivity: false, hasNotification: false, hasShortcut: false))
}
for flags in [(true, false, false, false), (false, true, false, false),
              (false, false, true, false), (false, false, false, true)] {
  check("scene external metadata cannot gain ordinary eligibility", !CodePushSceneEntryPolicy.isOrdinary(windowApplication: true,
    applicationLaunchKeys: [], hasURL: flags.0, hasUserActivity: flags.1, hasNotification: flags.2, hasShortcut: flags.3))
}

print("iOS native versions: \(checks - failures)/\(checks) checks passed")
exit(failures == 0 ? 0 : 1)
