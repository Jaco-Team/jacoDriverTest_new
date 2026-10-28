import Foundation
import CryptoKit
import Security
import Darwin

struct CodePushDownloadResult {
  let status: String
  let errorCode: String
  let packageId: String
  let version: String
  let nativeRuntimeId: String
  let packageSha256: String

  var dictionary: [String: String] {
    ["status": status, "errorCode": errorCode, "packageId": packageId,
     "version": version, "nativeRuntimeId": nativeRuntimeId, "packageSha256": packageSha256]
  }
}

/// Process-local diagnostic observation only; it never persists release state.
final class CodePushDownloadHistory {
  static let shared = CodePushDownloadHistory()
  private let lock = NSLock()
  private var value = CodePushDownloadResult(status: "not_checked", errorCode: "", packageId: "",
    version: "", nativeRuntimeId: "", packageSha256: "")
  func begin() {
    finish(CodePushDownloadResult(status: "checking", errorCode: "", packageId: "",
      version: "", nativeRuntimeId: "", packageSha256: ""))
  }
  func finish(_ result: CodePushDownloadResult) { lock.lock(); value = result; lock.unlock() }
  func snapshot() -> CodePushDownloadResult { lock.lock(); defer { lock.unlock() }; return value }
}

struct CodePushHTTPResponse {
  let statusCode: Int
  let contentLength: Int64?
  let finalURL: String
  let redirected: Bool
}

protocol CodePushDownloadTransport {
  func fetch(_ url: String, maxBytes: Int64, timeoutSeconds: TimeInterval,
             consume: @escaping (Data) throws -> Void) throws -> CodePushHTTPResponse
}

struct CodePushDownloadDependencies {
  let transport: CodePushDownloadTransport
  var nowMilliseconds: () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) }
  var monotonicSeconds: () -> TimeInterval = { ProcessInfo.processInfo.systemUptime }
  var freeBytes: (URL) throws -> Int64 = { url in
    let values = try url.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
    if let available = values.volumeAvailableCapacityForImportantUsage { return available }
    let attributes = try FileManager.default.attributesOfFileSystem(forPath: url.path)
    guard let available = attributes[.systemFreeSize] as? NSNumber else { throw CodePushDownloadFailure("io_error") }
    return available.int64Value
  }
  var fault: (String) throws -> Void = { _ in }
  var randomBytes: () throws -> Data = {
    var bytes = [UInt8](repeating: 0, count: 16)
    guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
      throw CodePushDownloadFailure("io_error")
    }
    return Data(bytes)
  }
}

/// Downloads immutable candidates only. It never selects a bundle, restarts RN,
/// changes startup state or touches authentication, orders, settings or maps.
final class CodePushDownloadManager {
  static let envelopeLimit = 704 * 1024
  static let diskReserve: Int64 = 16 * 1024 * 1024
  private let root: URL
  private let runtime: CodePushNativeRuntimeContext
  private let verifyEnvelope: (Data) throws -> Data
  private let dependencies: CodePushDownloadDependencies

  init(rootURL: URL, runtime: CodePushNativeRuntimeContext,
       verifyEnvelope: @escaping (Data) throws -> Data, dependencies: CodePushDownloadDependencies) {
    root = rootURL
    self.runtime = runtime
    self.verifyEnvelope = verifyEnvelope
    self.dependencies = dependencies
  }

  func checkAndDownload(timeoutSeconds: TimeInterval = 120,
                        isActive: @escaping () -> Bool = { true }) -> CodePushDownloadResult {
    CodePushDownloadHistory.shared.begin()
    var manifest: CodePushDownloadManifest?
    let started = dependencies.monotonicSeconds()
    let deadline = started + timeoutSeconds
    func remaining() throws -> TimeInterval {
      let now = dependencies.monotonicSeconds()
      guard timeoutSeconds.isFinite, timeoutSeconds > 0, timeoutSeconds <= 120,
            isActive(), started.isFinite, now.isFinite, now >= started, now < deadline else {
        throw CodePushDownloadFailure("network_timeout")
      }
      return deadline - now
    }
    do {
      try CodePushManifestValidator.require(CodePushManifestValidator.matches(runtime.nativeRuntimeId, "[a-f0-9]{64}")
        && ["ios", "android"].contains(runtime.platform) && runtime.appId == "jaco-driver", "runtime_invalid")
      try CodePushDownloadFiles.directory(root)
      var excluded = URLResourceValues()
      excluded.isExcludedFromBackup = true
      var rootResource = root
      try rootResource.setResourceValues(excluded)
      let lock = try CodePushDownloadFiles.openFile(root.appendingPathComponent("manager.lock"), flags: O_RDWR | O_CREAT)
      defer { close(lock) }
      guard flock(lock, LOCK_EX | LOCK_NB) == 0 else {
        if errno == EWOULDBLOCK || errno == EAGAIN { return result("busy") }
        throw CodePushDownloadFailure("io_error")
      }
      defer { _ = flock(lock, LOCK_UN) }
      let versionRoot = root.appendingPathComponent("v1", isDirectory: true)
      try CodePushDownloadFiles.directory(versionRoot)
      let runtimeRoot = versionRoot.appendingPathComponent(runtime.nativeRuntimeId, isDirectory: true)
      try CodePushDownloadFiles.directory(runtimeRoot)
      let candidates = runtimeRoot.appendingPathComponent("candidates", isDirectory: true)
      try CodePushDownloadFiles.directory(candidates)
      CodePushDownloadFiles.cleanupRecords(in: root)
      CodePushDownloadFiles.cleanupRecords(in: runtimeRoot)
      CodePushDownloadFiles.cleanupOrphans(in: candidates, entrypoint: runtime.platform == "ios" ? "main.jsbundle" : "index.android.bundle")
      let watermarkURL = runtimeRoot.appendingPathComponent("watermark.json")
      let previous = try watermark(watermarkURL)

      let manifestURL = "https://storage.yandexcloud.net/jaco-driver-codepush/\(runtime.platform)/\(runtime.nativeRuntimeId)/manifest.json"
      var envelope = Data()
      let response = try dependencies.transport.fetch(manifestURL, maxBytes: Int64(Self.envelopeLimit), timeoutSeconds: remaining()) { chunk in
        _ = try remaining()
        guard envelope.count + chunk.count <= Self.envelopeLimit else { throw CodePushDownloadFailure("input_too_large") }
        envelope.append(chunk)
      }
      try checkResponse(response, requested: manifestURL, count: Int64(envelope.count))
      let payload = try verifyEnvelope(envelope)
      let current = try CodePushManifestValidator.validate(payload, runtime: runtime, nowMilliseconds: dependencies.nowMilliseconds())
      _ = try remaining()
      manifest = current
      let payloadHash = Self.sha256(payload)
      if let previous = previous {
        try CodePushManifestValidator.require(current.sequence >= previous.sequence, "manifest_replayed")
        try CodePushManifestValidator.require(current.sequence != previous.sequence || payloadHash == previous.payloadHash, "manifest_sequence_conflict")
      }
      if previous == nil || current.sequence > previous!.sequence {
        try dependencies.fault("before_watermark_write")
        try CodePushDownloadFiles.atomicJSON([
          "schemaVersion": 1, "manifestSequence": current.sequence, "payloadSha256": payloadHash,
        ], to: watermarkURL)
        try dependencies.fault("after_watermark_write")
      }
      if !current.enabled { return result("disabled", manifest: current) }
      let installId = try installationId()
      if Self.rolloutSlot(installId: installId, appId: runtime.appId, seed: current.rolloutSeed) >= current.rolloutBasisPoints {
        return result("not_selected", manifest: current)
      }
      let candidate = candidates.appendingPathComponent(current.sha256 + "-" + payloadHash, isDirectory: true)
      if try CodePushDownloadFiles.exists(candidate) {
        try verifyCandidate(candidate, manifest: current, payloadHash: payloadHash, checkDeadline: { _ = try remaining() })
        _ = try remaining()
        try publishCandidatePointer(runtimeRoot, manifest: current, payloadHash: payloadHash)
        _ = try remaining()
        return result("already_downloaded", manifest: current)
      }
      let required = current.size + Self.diskReserve + Int64(envelope.count) + 16 * 1024
      try CodePushManifestValidator.require(dependencies.freeBytes(candidates) >= required, "insufficient_space")
      let temporary = candidates.appendingPathComponent(".tmp-" + UUID().uuidString.lowercased(), isDirectory: true)
      try CodePushDownloadFiles.directory(temporary, exclusive: true)
      var committed = false
      defer { if !committed { CodePushDownloadFiles.cleanupTemporary(temporary, entrypoint: current.entrypoint) } }
      let bundleURL = temporary.appendingPathComponent(current.entrypoint)
      let bundle = try CodePushDownloadFiles.openFile(bundleURL, flags: O_WRONLY | O_CREAT | O_EXCL)
      var bundleClosed = false
      defer { if !bundleClosed { close(bundle) } }
      var count: Int64 = 0
      var digest = SHA256()
      try dependencies.fault("before_bundle_write")
      let bundleResponse = try dependencies.transport.fetch(current.url, maxBytes: current.size, timeoutSeconds: remaining()) { chunk in
        _ = try remaining()
        guard Int64(chunk.count) <= current.size - count else { throw CodePushDownloadFailure("size_mismatch") }
        var position = 0
        while position < chunk.count {
          let part = chunk.subdata(in: position..<min(position + 64 * 1024, chunk.count))
          try CodePushManifestValidator.require(self.dependencies.freeBytes(temporary) >= Self.diskReserve + Int64(part.count), "insufficient_space")
          try CodePushDownloadFiles.writeAll(bundle, data: part)
          digest.update(data: part)
          count += Int64(part.count)
          position += part.count
        }
      }
      try checkResponse(bundleResponse, requested: current.url, count: count)
      try CodePushManifestValidator.require(count == current.size, "size_mismatch")
      let hash = digest.finalize().map { String(format: "%02x", $0) }.joined()
      try CodePushManifestValidator.require(hash == current.sha256, "hash_mismatch")
      try CodePushManifestValidator.require(fsync(bundle) == 0, "io_error")
      close(bundle); bundleClosed = true
      try dependencies.fault("after_bundle_write")
      try CodePushDownloadFiles.newFile(envelope, at: temporary.appendingPathComponent("manifest.json"))
      try dependencies.fault("before_metadata_write")
      try CodePushDownloadFiles.newFile(try metadataBytes(current, payloadHash: payloadHash), at: temporary.appendingPathComponent("metadata.json"))
      try CodePushDownloadFiles.syncDirectory(temporary)
      try dependencies.fault("before_candidate_commit")
      _ = try remaining()
      let renamed = temporary.path.withCString { from in candidate.path.withCString { to in
        renamex_np(from, to, UInt32(RENAME_EXCL))
      } }
      try CodePushManifestValidator.require(renamed == 0, "io_error")
      committed = true
      try CodePushDownloadFiles.syncDirectory(candidates)
      try dependencies.fault("after_candidate_commit")
      _ = try remaining()
      try publishCandidatePointer(runtimeRoot, manifest: current, payloadHash: payloadHash)
      _ = try remaining()
      return result("downloaded", manifest: current)
    } catch let error as CodePushDownloadFailure {
      return result("error", error: error.code, manifest: manifest)
    } catch let error as CodePushManifestVerificationError {
      return result("error", error: error.rawValue, manifest: manifest)
    } catch {
      return result("error", error: "io_error", manifest: manifest)
    }
  }

  private func result(_ status: String, error: String = "", manifest: CodePushDownloadManifest? = nil) -> CodePushDownloadResult {
    let value = CodePushDownloadResult(status: status, errorCode: error, packageId: manifest?.packageId ?? "",
      version: manifest?.version ?? "", nativeRuntimeId: runtime.nativeRuntimeId, packageSha256: manifest?.sha256 ?? "")
    CodePushDownloadHistory.shared.finish(value)
    return value
  }

  private func checkResponse(_ response: CodePushHTTPResponse, requested: String, count: Int64) throws {
    try CodePushManifestValidator.require(!response.redirected && response.finalURL == requested, "redirect_rejected")
    try CodePushManifestValidator.require(response.statusCode == 200, "http_error")
    if let length = response.contentLength { try CodePushManifestValidator.require(length == count, "size_mismatch") }
  }

  private struct Watermark { let sequence: Int64; let payloadHash: String }
  private func watermark(_ url: URL) throws -> Watermark? {
    if try !CodePushDownloadFiles.exists(url) { return nil }
    do {
      let data = try CodePushStrictJSON.parse(CodePushDownloadFiles.read(url, limit: 4096), limit: 4096)
      let record = try CodePushManifestValidator.object(data, keys: ["schemaVersion", "manifestSequence", "payloadSha256"])
      try CodePushManifestValidator.require(try CodePushManifestValidator.integer(record["schemaVersion"], min: 1, max: 1) == 1, "state_invalid")
      let sequence = try CodePushManifestValidator.integer(record["manifestSequence"], min: 1, max: CodePushManifestValidator.maximumSafeInteger)
      let hash = try CodePushManifestValidator.text(record["payloadSha256"], pattern: "[a-f0-9]{64}")
      return Watermark(sequence: sequence, payloadHash: hash)
    } catch { throw CodePushDownloadFailure("state_invalid") }
  }

  private func installationId() throws -> String {
    let url = root.appendingPathComponent("install-id.json")
    if try CodePushDownloadFiles.exists(url) {
      do {
        let record = try CodePushManifestValidator.object(CodePushStrictJSON.parse(CodePushDownloadFiles.read(url, limit: 4096), limit: 4096), keys: ["schemaVersion", "installId"])
        _ = try CodePushManifestValidator.integer(record["schemaVersion"], min: 1, max: 1)
        return try CodePushManifestValidator.text(record["installId"], pattern: "[a-f0-9]{32}")
      } catch { throw CodePushDownloadFailure("state_invalid") }
    }
    let random = try dependencies.randomBytes()
    try CodePushManifestValidator.require(random.count == 16, "io_error")
    let id = random.map { String(format: "%02x", $0) }.joined()
    try CodePushDownloadFiles.atomicJSON(["schemaVersion": 1, "installId": id], to: url)
    return id
  }

  private func metadataBytes(_ manifest: CodePushDownloadManifest, payloadHash: String) throws -> Data {
    try CodePushCandidateVerifier.metadataBytes(manifest, payloadHash: payloadHash)
  }

  private func publishCandidatePointer(_ runtimeRoot: URL, manifest: CodePushDownloadManifest, payloadHash: String) throws {
    try dependencies.fault("before_candidate_pointer_write")
    try CodePushDownloadFiles.atomicJSON(["packageSha256": manifest.sha256, "payloadSha256": payloadHash],
      to: runtimeRoot.appendingPathComponent("candidate.json"))
    try dependencies.fault("after_candidate_pointer_write")
  }

  private func verifyCandidate(_ directory: URL, manifest: CodePushDownloadManifest, payloadHash: String,
                               checkDeadline: () throws -> Void) throws {
    _ = try CodePushCandidateVerifier.verify(directory, runtime: runtime,
      packageSha256: manifest.sha256, payloadSha256: payloadHash, verifyEnvelope: verifyEnvelope,
      validatePayload: { try CodePushManifestValidator.validate($0, runtime: self.runtime,
        nowMilliseconds: self.dependencies.nowMilliseconds()) }, checkDeadline: checkDeadline)
  }

  static func sha256(_ data: Data) -> String {
    SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
  }

  static func rolloutSlot(installId: String, appId: String, seed: String) -> Int64 {
    let bytes = Array(SHA256.hash(data: Data(("jaco-driver-codepush-rollout-v1\n" + installId + "\n" + appId + "\n" + seed).utf8)))
    let unsigned = UInt32(bytes[0]) << 24 | UInt32(bytes[1]) << 16 | UInt32(bytes[2]) << 8 | UInt32(bytes[3])
    return Int64(unsigned % 10_000)
  }
}

/// Shared on-disk verification. Download admission and confirmed-version startup
/// deliberately supply different payload policies while sharing all integrity checks.
enum CodePushCandidateVerifier {
  static func metadataBytes(_ manifest: CodePushDownloadManifest, payloadHash: String) throws -> Data {
    try JSONSerialization.data(withJSONObject: [
      "schemaVersion": 1, "packageId": manifest.packageId, "nativeRuntimeId": manifest.nativeRuntimeId,
      "packageSha256": manifest.sha256, "payloadSha256": payloadHash, "manifestSequence": manifest.sequence,
      "version": manifest.version, "size": manifest.size, "entrypoint": manifest.entrypoint,
    ], options: [.sortedKeys])
  }

  static func verify(_ directory: URL, runtime: CodePushNativeRuntimeContext,
                     packageSha256: String, payloadSha256: String,
                     verifyEnvelope: (Data) throws -> Data,
                     validatePayload: (Data) throws -> CodePushDownloadManifest,
                     checkDeadline: () throws -> Void = {}) throws -> CodePushDownloadManifest {
    do {
      try checkDeadline()
      try CodePushDownloadFiles.requireDirectory(directory.deletingLastPathComponent())
      try CodePushDownloadFiles.requireDirectory(directory)
      let entrypoint = runtime.platform == "ios" ? "main.jsbundle" : "index.android.bundle"
      let expectedNames = Set([entrypoint, "manifest.json", "metadata.json"])
      try CodePushManifestValidator.require(Set(try CodePushDownloadFiles.boundedEntries(directory, maximum: 3,
        checkDeadline: checkDeadline)) == expectedNames, "candidate_invalid")
      try checkDeadline()
      let envelope = try CodePushDownloadFiles.read(directory.appendingPathComponent("manifest.json"), limit: CodePushDownloadManager.envelopeLimit)
      try checkDeadline()
      let payload = try verifyEnvelope(envelope)
      try checkDeadline()
      try CodePushManifestValidator.require(CodePushDownloadManager.sha256(payload) == payloadSha256, "candidate_invalid")
      let manifest = try validatePayload(payload)
      try CodePushManifestValidator.require(manifest.sha256 == packageSha256 && manifest.entrypoint == entrypoint, "candidate_invalid")
      try checkDeadline()
      let bytes = try CodePushDownloadFiles.read(directory.appendingPathComponent("metadata.json"), limit: 16 * 1024)
      let object = try CodePushStrictJSON.parse(bytes, limit: 16 * 1024)
      let canonical = try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
      try CodePushManifestValidator.require(canonical == metadataBytes(manifest, payloadHash: payloadSha256), "candidate_invalid")
      try checkDeadline()
      let file = try CodePushDownloadFiles.openFile(directory.appendingPathComponent(entrypoint), flags: O_RDONLY)
      defer { close(file) }
      var digest = SHA256()
      var count: Int64 = 0
      let chunk = UnsafeMutablePointer<UInt8>.allocate(capacity: 64 * 1024)
      defer { chunk.deallocate() }
      while true {
        try checkDeadline()
        let size = Darwin.read(file, chunk, 64 * 1024)
        if size < 0 { if errno == EINTR { continue }; throw CodePushDownloadFailure("candidate_invalid") }
        if size == 0 { break }
        count += Int64(size)
        try CodePushManifestValidator.require(count <= manifest.size, "candidate_invalid")
        digest.update(data: Data(bytes: chunk, count: size))
      }
      try checkDeadline()
      let hash = digest.finalize().map { String(format: "%02x", $0) }.joined()
      try CodePushManifestValidator.require(count == manifest.size && hash == manifest.sha256, "candidate_invalid")
      try checkDeadline()
      return manifest
    } catch let error as CodePushDownloadFailure where ["network_timeout", "startup_timeout"].contains(error.code) {
      throw error
    } catch {
      throw CodePushDownloadFailure("candidate_invalid")
    }
  }
}

enum CodePushDownloadFiles {
  static func boundedEntries(_ url: URL, maximum: Int, checkDeadline: () throws -> Void) throws -> [String] {
    let descriptor = Darwin.open(url.path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
    guard descriptor >= 0 else { throw CodePushDownloadFailure("state_invalid") }
    guard let directory = fdopendir(descriptor) else {
      close(descriptor)
      throw CodePushDownloadFailure("state_invalid")
    }
    defer { closedir(directory) }
    var result: [String] = []
    while true {
      try checkDeadline()
      errno = 0
      guard let entry = readdir(directory) else {
        try CodePushManifestValidator.require(errno == 0, "state_invalid")
        return result
      }
      let length = Int(entry.pointee.d_namlen)
      let bytes = withUnsafeBytes(of: entry.pointee.d_name) { Data($0.prefix(length)) }
      guard let name = String(data: bytes, encoding: .utf8) else { throw CodePushDownloadFailure("state_invalid") }
      if name == "." || name == ".." { continue }
      result.append(name)
      try CodePushManifestValidator.require(result.count <= maximum, "state_invalid")
    }
  }

  static func exists(_ url: URL) throws -> Bool {
    var info = stat()
    if lstat(url.path, &info) == 0 { return true }
    if errno == ENOENT { return false }
    throw CodePushDownloadFailure("io_error")
  }

  static func directory(_ url: URL, exclusive: Bool = false) throws {
    if mkdir(url.path, 0o700) != 0 {
      if errno != EEXIST || exclusive { throw CodePushDownloadFailure("io_error") }
    }
    try requireDirectory(url)
  }

  static func requireDirectory(_ url: URL) throws {
    var info = stat()
    try CodePushManifestValidator.require(lstat(url.path, &info) == 0 && info.st_mode & S_IFMT == S_IFDIR, "state_invalid")
  }

  static func openFile(_ url: URL, flags: Int32) throws -> Int32 {
    let descriptor = Darwin.open(url.path, flags | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK, 0o600)
    guard descriptor >= 0 else { throw CodePushDownloadFailure("io_error") }
    var info = stat()
    guard fstat(descriptor, &info) == 0 && info.st_mode & S_IFMT == S_IFREG && info.st_nlink == 1 else {
      close(descriptor)
      throw CodePushDownloadFailure("state_invalid")
    }
    return descriptor
  }

  static func read(_ url: URL, limit: Int) throws -> Data {
    let descriptor = try openFile(url, flags: O_RDONLY)
    defer { close(descriptor) }
    var info = stat()
    try CodePushManifestValidator.require(fstat(descriptor, &info) == 0 && info.st_size >= 0 && info.st_size <= limit, "state_invalid")
    var result = Data()
    var buffer = [UInt8](repeating: 0, count: min(64 * 1024, limit + 1))
    while result.count <= limit {
      let count = Darwin.read(descriptor, &buffer, min(buffer.count, limit + 1 - result.count))
      if count < 0 { if errno == EINTR { continue }; throw CodePushDownloadFailure("io_error") }
      if count == 0 { return result }
      result.append(contentsOf: buffer.prefix(count))
    }
    throw CodePushDownloadFailure("state_invalid")
  }

  static func writeAll(_ descriptor: Int32, data: Data) throws {
    try data.withUnsafeBytes { bytes in
      guard let base = bytes.baseAddress else { return }
      var written = 0
      while written < bytes.count {
        let count = Darwin.write(descriptor, base.advanced(by: written), bytes.count - written)
        if count < 0 && errno == EINTR { continue }
        guard count > 0 else { throw CodePushDownloadFailure(errno == ENOSPC ? "insufficient_space" : "io_error") }
        written += count
      }
    }
  }

  static func newFile(_ data: Data, at url: URL) throws {
    let descriptor = try openFile(url, flags: O_WRONLY | O_CREAT | O_EXCL)
    defer { close(descriptor) }
    try writeAll(descriptor, data: data)
    try CodePushManifestValidator.require(fsync(descriptor) == 0, "io_error")
  }

  static func atomicJSON(_ object: [String: Any], to destination: URL) throws {
    if try exists(destination) {
      let descriptor = try openFile(destination, flags: O_RDONLY)
      close(descriptor)
    }
    let temporary = destination.deletingLastPathComponent().appendingPathComponent(".record-" + UUID().uuidString.lowercased())
    defer { _ = unlink(temporary.path) }
    try newFile(try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]), at: temporary)
    try CodePushManifestValidator.require(rename(temporary.path, destination.path) == 0, "io_error")
    try syncDirectory(destination.deletingLastPathComponent())
  }

  static func syncDirectory(_ url: URL) throws {
    let descriptor = Darwin.open(url.path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
    guard descriptor >= 0 else { throw CodePushDownloadFailure("io_error") }
    defer { close(descriptor) }
    try CodePushManifestValidator.require(fsync(descriptor) == 0, "io_error")
  }

  static func cleanupTemporary(_ url: URL, entrypoint: String) {
    guard (try? requireDirectory(url)) != nil else { return }
    for name in [entrypoint, "manifest.json", "metadata.json"] {
      let file = url.appendingPathComponent(name)
      var info = stat()
      if lstat(file.path, &info) == 0 && info.st_mode & S_IFMT == S_IFREG { _ = unlink(file.path) }
    }
    _ = rmdir(url.path)
  }

  static func cleanupRecords(in directory: URL) {
    guard let names = try? FileManager.default.contentsOfDirectory(atPath: directory.path) else { return }
    for name in names where ownedName(name, prefix: ".record-") {
      let file = directory.appendingPathComponent(name)
      var info = stat()
      if lstat(file.path, &info) == 0 && info.st_mode & S_IFMT == S_IFREG && info.st_nlink == 1 {
        _ = unlink(file.path)
      }
    }
  }

  static func cleanupOrphans(in directory: URL, entrypoint: String) {
    guard let names = try? FileManager.default.contentsOfDirectory(atPath: directory.path) else { return }
    let allowed = Set([entrypoint, "manifest.json", "metadata.json"])
    for name in names where ownedName(name, prefix: ".tmp-") {
      let temporary = directory.appendingPathComponent(name, isDirectory: true)
      guard (try? requireDirectory(temporary)) != nil,
            let children = try? FileManager.default.contentsOfDirectory(atPath: temporary.path),
            Set(children).isSubset(of: allowed) else { continue }
      let regular = children.allSatisfy { child in
        var info = stat()
        return lstat(temporary.appendingPathComponent(child).path, &info) == 0
          && info.st_mode & S_IFMT == S_IFREG && info.st_nlink == 1
      }
      if regular { cleanupTemporary(temporary, entrypoint: entrypoint) }
    }
  }

  private static func ownedName(_ name: String, prefix: String) -> Bool {
    guard name.hasPrefix(prefix) else { return false }
    let suffix = String(name.dropFirst(prefix.count))
    guard let uuid = UUID(uuidString: suffix) else { return false }
    return uuid.uuidString.lowercased() == suffix
  }
}
