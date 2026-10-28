import Foundation

struct DownloadVector {
  let name: String
  let envelope: Data
  let publicKey: String
  let now: Int64
  let expectedStatus: String
  let expectedErrors: [String]
  let bundle: Data
  let installId: String
}

final class FixtureTransport: CodePushDownloadTransport {
  let envelope: Data
  var bundle: Data
  var urls: [String] = []
  var manifestStatus = 200
  var bundleStatus = 200
  var redirected = false
  var lengthDelta: Int64 = 0
  var omitLength = false
  var failAfterFirstBundleChunk = false
  var manifestGate: (() -> Void)?
  var onBundle: (() -> Void)?
  var chunkSize = 3

  init(_ vector: DownloadVector) { envelope = vector.envelope; bundle = vector.bundle }

  func fetch(_ url: String, maxBytes: Int64, timeoutSeconds: TimeInterval,
             consume: @escaping (Data) throws -> Void) throws -> CodePushHTTPResponse {
    urls.append(url)
    let manifest = url.hasSuffix("/manifest.json")
    if manifest { manifestGate?() } else { onBundle?() }
    let bytes = manifest ? envelope : bundle
    var offset = 0
    while offset < bytes.count {
      let end = min(offset + (manifest ? 64 * 1024 : chunkSize), bytes.count)
      try consume(bytes.subdata(in: offset..<end))
      offset = end
      if !manifest && failAfterFirstBundleChunk { throw CodePushDownloadFailure("network_error") }
    }
    return CodePushHTTPResponse(statusCode: manifest ? manifestStatus : bundleStatus,
      contentLength: omitLength ? nil : Int64(bytes.count) + lengthDelta,
      finalURL: redirected ? url + "?redirected" : url, redirected: redirected)
  }
}

let runtime = CodePushNativeRuntimeContext(appId: "jaco-driver",
  applicationIdentifier: "org.reactjs.native.example.jacoDriverTest", platform: "ios",
  nativeRuntimeId: String(repeating: "b", count: 64), nativeBuild: "26", rnVersion: "0.88.0",
  hermesVersion: "260318099.0.4", bundleFormat: "js")
let fixtureRows = try String(contentsOfFile: CommandLine.arguments[1], encoding: .utf8)
var vectors: [DownloadVector] = []
for row in fixtureRows.split(separator: "\n") {
  let fields = row.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
  if fields[1] != "ios" { continue }
  func decoded(_ index: Int) -> Data { Data(base64Encoded: fields[index])! }
  vectors.append(DownloadVector(name: String(data: decoded(0), encoding: .utf8)!, envelope: decoded(2),
    publicKey: fields[3], now: Int64(fields[4])!, expectedStatus: fields[5],
    expectedErrors: fields[6].split(separator: ",").map(String.init), bundle: decoded(7), installId: fields[8]))
}
guard let valid = vectors.first(where: { $0.name == "ios/valid" }) else { fatalError("Missing iOS vector") }
var checked = 0
var failures = 0
func check(_ name: String, _ condition: @autoclosure () throws -> Bool) {
  checked += 1
  do {
    if try !condition() { failures += 1; print("FAIL iOS download: " + name) }
  } catch {
    failures += 1; print("FAIL iOS download: " + name + " (fixture error)")
  }
}

func fixture(_ body: (URL) throws -> Void) rethrows {
  let parent = FileManager.default.temporaryDirectory.appendingPathComponent("jaco-ios-download-" + UUID().uuidString)
  try! FileManager.default.createDirectory(at: parent, withIntermediateDirectories: false)
  defer { try? FileManager.default.removeItem(at: parent) }
  try body(parent.appendingPathComponent("codepush", isDirectory: true))
}

func dependencies(_ vector: DownloadVector, _ transport: FixtureTransport) -> CodePushDownloadDependencies {
  var result = CodePushDownloadDependencies(transport: transport)
  result.nowMilliseconds = { vector.now }
  result.freeBytes = { _ in 1024 * 1024 * 1024 }
  result.randomBytes = { Data(repeating: 0, count: 16) }
  return result
}

func manager(_ root: URL, _ vector: DownloadVector = valid, transport: FixtureTransport? = nil,
             customize: (inout CodePushDownloadDependencies) -> Void = { _ in }) -> CodePushDownloadManager {
  let transport = transport ?? FixtureTransport(vector)
  var injected = dependencies(vector, transport)
  customize(&injected)
  return CodePushDownloadManager(rootURL: root, runtime: runtime, verifyEnvelope: {
    try CodePushManifestVerifier.verify($0, trustedKeys: ["download-test-key": vector.publicKey]).get()
  }, dependencies: injected)
}

func runtimeRoot(_ root: URL) -> URL { root.appendingPathComponent("v1/" + runtime.nativeRuntimeId) }
func candidateRoot(_ root: URL) -> URL { runtimeRoot(root).appendingPathComponent("candidates") }
func candidate(_ root: URL) throws -> URL {
  let names = try FileManager.default.contentsOfDirectory(atPath: candidateRoot(root).path).filter { !$0.hasPrefix(".") }
  guard names.count == 1 else { throw CodePushDownloadFailure("fixture_invalid") }
  return candidateRoot(root).appendingPathComponent(names[0])
}
func temporaryCount(_ root: URL) -> Int {
  ((try? FileManager.default.contentsOfDirectory(atPath: candidateRoot(root).path)) ?? []).filter { $0.hasPrefix(".tmp-") }.count
}
func writeJSON(_ object: [String: Any], _ url: URL) throws {
  try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]).write(to: url)
}

for vector in vectors {
  fixture { root in
    let transport = FixtureTransport(vector)
    let result = manager(root, vector, transport: transport).checkAndDownload()
    check(vector.name + " status " + result.status + "/" + result.errorCode,
      result.status == vector.expectedStatus && (result.status != "error" || vector.expectedErrors.contains(result.errorCode)))
    check(vector.name + " result fields", result.dictionary.count == 6)
    if vector.expectedStatus != "downloaded" { check(vector.name + " no bundle fetch", transport.urls.count == 1) }
    if vector.expectedStatus == "downloaded" { check(vector.name + " temp cleaned", temporaryCount(root) == 0) }
  }
}

try fixture { root in
  let first = manager(root).checkAndDownload()
  let transport = FixtureTransport(valid)
  let second = manager(root, transport: transport).checkAndDownload()
  check("valid first candidate", first.status == "downloaded")
  check("existing candidate reverified", second.status == "already_downloaded" && transport.urls.count == 1)
  check("same package identity", first.packageId == second.packageId && !first.packageId.isEmpty)
  check("candidate fixed layout", try Set(FileManager.default.contentsOfDirectory(atPath: candidate(root).path)) == Set(["main.jsbundle", "manifest.json", "metadata.json"]))
}

try fixture { root in
  _ = manager(root).checkAndDownload()
  let bundle = try candidate(root).appendingPathComponent("main.jsbundle")
  try Data("corrupted".utf8).write(to: bundle)
  check("cached hash corruption rejected", manager(root).checkAndDownload().errorCode == "candidate_invalid")
}

try fixture { root in
  _ = manager(root).checkAndDownload()
  let envelope = try candidate(root).appendingPathComponent("manifest.json")
  try Data("{}".utf8).write(to: envelope)
  check("cached signed manifest corruption rejected", manager(root).checkAndDownload().errorCode == "candidate_invalid")
}

try fixture { root in
  _ = manager(root).checkAndDownload()
  let stored = try candidate(root).appendingPathComponent("metadata.json")
  try Data("{}".utf8).write(to: stored)
  check("cached metadata corruption rejected", manager(root).checkAndDownload().errorCode == "candidate_invalid")
}

fixture { root in
  let transport = FixtureTransport(valid)
  transport.bundle = Data(valid.bundle.dropLast())
  let result = manager(root, transport: transport).checkAndDownload()
  check("short bundle rejected", result.errorCode == "size_mismatch")
  check("short bundle temp cleanup", temporaryCount(root) == 0)
}

fixture { root in
  let transport = FixtureTransport(valid)
  transport.bundle.append(0)
  check("overlong bundle rejected", manager(root, transport: transport).checkAndDownload().errorCode == "size_mismatch")
  check("overlong bundle temp cleanup", temporaryCount(root) == 0)
}

fixture { root in
  let transport = FixtureTransport(valid)
  transport.bundle[0] ^= 1
  check("wrong bundle hash rejected", manager(root, transport: transport).checkAndDownload().errorCode == "hash_mismatch")
}

for status in [302, 404, 500] {
  fixture { root in
    let transport = FixtureTransport(valid)
    transport.manifestStatus = status
    check("HTTP manifest status \(status)", manager(root, transport: transport).checkAndDownload().errorCode == "http_error")
  }
}

fixture { root in
  let transport = FixtureTransport(valid)
  transport.bundleStatus = 500
  check("HTTP bundle error", manager(root, transport: transport).checkAndDownload().errorCode == "http_error")
  check("HTTP bundle error temp cleanup", temporaryCount(root) == 0)
}

fixture { root in
  let transport = FixtureTransport(valid)
  transport.redirected = true
  check("redirect rejected", manager(root, transport: transport).checkAndDownload().errorCode == "redirect_rejected")
}

fixture { root in
  let transport = FixtureTransport(valid)
  transport.lengthDelta = 1
  check("Content-Length mismatch rejected", manager(root, transport: transport).checkAndDownload().errorCode == "size_mismatch")
}

fixture { root in
  let transport = FixtureTransport(valid)
  transport.omitLength = true
  check("bounded body without Content-Length accepted", manager(root, transport: transport).checkAndDownload().status == "downloaded")
}

fixture { root in
  let result = manager(root, customize: { $0.freeBytes = { _ in 1 } }).checkAndDownload()
  check("disk reserve before transfer", result.errorCode == "insufficient_space")
}

fixture { root in
  var calls = 0
  let result = manager(root, customize: { dependencies in
    dependencies.freeBytes = { _ in calls += 1; return calls == 1 ? 1024 * 1024 * 1024 : 0 }
  }).checkAndDownload()
  check("disk pressure during stream", result.errorCode == "insufficient_space")
  check("disk pressure temp cleanup", temporaryCount(root) == 0)
}

fixture { root in
  let transport = FixtureTransport(valid)
  transport.failAfterFirstBundleChunk = true
  check("interrupted stream rejected", manager(root, transport: transport).checkAndDownload().errorCode == "network_error")
  check("interrupted stream temp cleanup", temporaryCount(root) == 0)
  check("retry explicit next call", manager(root).checkAndDownload().status == "downloaded")
}

fixture { root in
  var monotonic: TimeInterval = 0
  let transport = FixtureTransport(valid)
  transport.onBundle = { monotonic = 121 }
  let result = manager(root, transport: transport, customize: { $0.monotonicSeconds = { monotonic } }).checkAndDownload()
  check("shared total operation deadline", result.errorCode == "network_timeout")
  check("deadline temp cleanup", temporaryCount(root) == 0)
}

for stage in ["before_watermark_write", "after_watermark_write", "before_bundle_write", "after_bundle_write", "before_metadata_write", "before_candidate_commit", "after_candidate_commit"] {
  fixture { root in
    let result = manager(root, customize: { dependencies in
      dependencies.fault = { if $0 == stage { throw CodePushDownloadFailure("io_error") } }
    }).checkAndDownload()
    check("fault " + stage, result.status == "error" && result.errorCode == "io_error")
    check("fault cleanup " + stage, temporaryCount(root) == 0)
    let retry = manager(root).checkAndDownload()
    check("fault recovery " + stage, retry.status == (stage == "after_candidate_commit" ? "already_downloaded" : "downloaded"))
  }
}

try fixture { root in
  _ = manager(root).checkAndDownload()
  let watermark = runtimeRoot(root).appendingPathComponent("watermark.json")
  try Data("broken".utf8).write(to: watermark)
  let transport = FixtureTransport(valid)
  check("corrupt replay state fails closed", manager(root, transport: transport).checkAndDownload().errorCode == "state_invalid")
  check("corrupt replay state no network", transport.urls.isEmpty)
}

try fixture { root in
  _ = manager(root).checkAndDownload()
  try Data("broken".utf8).write(to: root.appendingPathComponent("install-id.json"))
  check("corrupt installation ID fails closed", manager(root).checkAndDownload().errorCode == "state_invalid")
}

if let maximum = vectors.first(where: { $0.name == "ios/valid-maximum-sequence" }),
   let disabled = vectors.first(where: { $0.name == "ios/disabled" }),
   let conflict = vectors.first(where: { $0.name == "ios/valid-exact-payload-whitespace" }),
   let invalid = vectors.first(where: { $0.name == "ios/runtime-mismatch" }) {
  fixture { root in
    check("highest sequence accepted", manager(root, maximum).checkAndDownload().status == "downloaded")
    check("lower sequence replay rejected", manager(root).checkAndDownload().errorCode == "manifest_replayed")
  }
  fixture { root in
    _ = manager(root).checkAndDownload()
    check("equal sequence changed payload rejected", manager(root, conflict).checkAndDownload().errorCode == "manifest_sequence_conflict")
  }
  try fixture { root in
    _ = manager(root, disabled).checkAndDownload()
    let record = try JSONSerialization.jsonObject(with: Data(contentsOf: runtimeRoot(root).appendingPathComponent("watermark.json"))) as! [String: Any]
    check("disabled signed manifest persists watermark", record["manifestSequence"] as? NSNumber != nil)
    check("disabled watermark rejects conflicting enabled payload", manager(root).checkAndDownload().errorCode == "manifest_sequence_conflict")
  }
  try fixture { root in
    _ = manager(root).checkAndDownload()
    let file = runtimeRoot(root).appendingPathComponent("watermark.json")
    let before = try Data(contentsOf: file)
    check("wrong runtime rejected before persistence", manager(root, invalid).checkAndDownload().errorCode == "runtime_mismatch")
    check("invalid runtime leaves watermark intact", try Data(contentsOf: file) == before)
  }
}

try fixture { root in
  let outside = root.deletingLastPathComponent().appendingPathComponent("auth-user-data")
  try Data("preserve token and orders".utf8).write(to: outside)
  _ = manager(root).checkAndDownload()
  let bundle = try candidate(root).appendingPathComponent("main.jsbundle")
  try FileManager.default.removeItem(at: bundle)
  try FileManager.default.createSymbolicLink(at: bundle, withDestinationURL: outside)
  check("candidate symlink rejected", manager(root).checkAndDownload().errorCode == "candidate_invalid")
  check("candidate symlink target preserved", try String(contentsOf: outside, encoding: .utf8) == "preserve token and orders")
}

try fixture { root in
  let outside = root.deletingLastPathComponent().appendingPathComponent("unrelated")
  try FileManager.default.createDirectory(at: outside, withIntermediateDirectories: false)
  try Data("preserve".utf8).write(to: outside.appendingPathComponent("sentinel"))
  try FileManager.default.createSymbolicLink(at: root, withDestinationURL: outside)
  check("updater root symlink rejected", manager(root).checkAndDownload().status == "error")
  check("root symlink target preserved", try String(contentsOf: outside.appendingPathComponent("sentinel"), encoding: .utf8) == "preserve")
}

try fixture { root in
  _ = manager(root).checkAndDownload()
  let records = [root.appendingPathComponent(".record-" + UUID().uuidString.lowercased()), runtimeRoot(root).appendingPathComponent(".record-" + UUID().uuidString.lowercased())]
  for file in records { try Data("partial record".utf8).write(to: file) }
  let abandoned = candidateRoot(root).appendingPathComponent(".tmp-" + UUID().uuidString.lowercased())
  try FileManager.default.createDirectory(at: abandoned, withIntermediateDirectories: false)
  try Data("partial bundle".utf8).write(to: abandoned.appendingPathComponent("main.jsbundle"))
  let suspicious = candidateRoot(root).appendingPathComponent(".tmp-" + UUID().uuidString.lowercased())
  try FileManager.default.createDirectory(at: suspicious, withIntermediateDirectories: false)
  let sentinel = suspicious.appendingPathComponent("unrelated-user-data")
  try Data("preserve".utf8).write(to: sentinel)
  let linked = candidateRoot(root).appendingPathComponent(".tmp-" + UUID().uuidString.lowercased())
  try FileManager.default.createSymbolicLink(at: linked, withDestinationURL: suspicious)
  let result = manager(root).checkAndDownload()
  check("restart retains immutable candidate", result.status == "already_downloaded")
  check("restart cleans owned abandoned temporary", !FileManager.default.fileExists(atPath: abandoned.path))
  check("restart cleans owned atomic record leftovers", records.allSatisfy { !FileManager.default.fileExists(atPath: $0.path) })
  check("restart preserves unknown child", try String(contentsOf: sentinel, encoding: .utf8) == "preserve")
  check("restart preserves suspicious symlink", (try? FileManager.default.destinationOfSymbolicLink(atPath: linked.path)) != nil)
}

fixture { root in
  let entered = DispatchSemaphore(value: 0), release = DispatchSemaphore(value: 0)
  let completed = DispatchSemaphore(value: 0)
  let transport = FixtureTransport(valid)
  transport.manifestGate = { entered.signal(); _ = release.wait(timeout: .now() + 5) }
  let first = manager(root, transport: transport)
  var firstStatus = ""
  DispatchQueue.global().async {
    firstStatus = first.checkAndDownload().status
    completed.signal()
  }
  let began = entered.wait(timeout: .now() + 5) == .success
  let second = manager(root).checkAndDownload()
  release.signal()
  let ended = completed.wait(timeout: .now() + 5) == .success
  check("concurrent call returns busy", began && second.status == "busy")
  check("owner completes exactly one candidate", ended && firstStatus == "downloaded")
}

print("iOS native download: \(checked - failures)/\(checked) checks passed")
exit(failures == 0 ? 0 : 1)
