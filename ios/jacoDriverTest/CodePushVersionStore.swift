import Foundation
import CoreFoundation
import Security
import Darwin

struct CodePushVersionReference: Equatable {
  let packageSha256: String
  let payloadSha256: String
  var json: [String: String] { ["packageSha256": packageSha256, "payloadSha256": payloadSha256] }
}

struct CodePushVersionSelection {
  let source: String
  let localURL: URL?
  let packageId: String
  let version: String
  let reason: String
  var packageSha256: String = ""
  var payloadSha256: String = ""
  var attemptId: String = ""
  var processToken: String = ""

  static func embedded(_ reason: String) -> CodePushVersionSelection {
    CodePushVersionSelection(source: "embedded", localURL: nil, packageId: "", version: "", reason: reason)
  }
  var reference: CodePushVersionReference? {
    guard !packageSha256.isEmpty && !payloadSha256.isEmpty else { return nil }
    return CodePushVersionReference(packageSha256: packageSha256, payloadSha256: payloadSha256)
  }
}

struct CodePushLaunchResult {
  let status: String
  let errorCode: String
  let packageId: String
  let version: String
  let nativeRuntimeId: String
  let attemptId: String
  let source: String
  var dictionary: [String: String] {
    ["status": status, "errorCode": errorCode, "packageId": packageId, "version": version,
     "nativeRuntimeId": nativeRuntimeId, "attemptId": attemptId, "source": source]
  }
  static func failure(_ code: String) -> CodePushLaunchResult {
    CodePushLaunchResult(status: "error", errorCode: code, packageId: "", version: "",
      nativeRuntimeId: "", attemptId: "", source: "")
  }
  static func selected(_ selection: CodePushVersionSelection, runtime: String, status: String = "running") -> CodePushLaunchResult {
    CodePushLaunchResult(status: status, errorCode: "", packageId: selection.packageId, version: selection.version,
      nativeRuntimeId: runtime, attemptId: selection.attemptId, source: selection.source)
  }
}

struct CodePushStorageDiagnostics {
  var storageStatus = "missing"
  var errorCode = ""
  var currentPackageId = ""
  var currentVersion = ""
  var previousPackageId = ""
  var previousVersion = ""
  var candidatePackageId = ""
  var candidateVersion = ""
  var candidateStatus = "none"
  var lastEvent = ""
  var lastEventPackageSha256 = ""
}

enum CodePushProcessIdentity {
  static let token = randomToken()
  static func randomToken() -> String {
    var bytes = [UInt8](repeating: 0, count: 16)
    guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { return "" }
    return bytes.map { String(format: "%02x", $0) }.joined()
  }
}

/// Confirmed references survive offline; an eligible ordinary launch may try one
/// exact pointer only after recording a durable pending attempt. No JS reloads.
final class CodePushVersionStore {
  private let root: URL
  private let runtime: CodePushNativeRuntimeContext
  private let verifyEnvelope: (Data) throws -> Data
  private let monotonicSeconds: () -> TimeInterval
  private let nowMilliseconds: () -> Int64
  private let processToken: String
  private let randomAttemptId: () -> String
  private let fault: (String) throws -> Void
  private let budgetMilliseconds: Int

  init(rootURL: URL, runtime: CodePushNativeRuntimeContext,
       verifyEnvelope: @escaping (Data) throws -> Data,
       monotonicSeconds: @escaping () -> TimeInterval = { ProcessInfo.processInfo.systemUptime },
       budgetMilliseconds: Int = 1500,
       nowMilliseconds: @escaping () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) },
       processToken: String = CodePushProcessIdentity.token,
       randomAttemptId: @escaping () -> String = { CodePushProcessIdentity.randomToken() },
       fault: @escaping (String) throws -> Void = { _ in }) {
    root = rootURL
    self.runtime = runtime
    self.verifyEnvelope = verifyEnvelope
    self.monotonicSeconds = monotonicSeconds
    self.budgetMilliseconds = budgetMilliseconds
    self.nowMilliseconds = nowMilliseconds
    self.processToken = processToken
    self.randomAttemptId = randomAttemptId
    self.fault = fault
  }

  private struct Pending {
    let attemptId: String
    let processToken: String
    let candidate: CodePushVersionReference
    let fallback: CodePushVersionReference?
    var json: [String: Any] { ["attemptId": attemptId, "processToken": processToken,
      "candidate": candidate.json, "fallback": fallback?.json as Any? ?? NSNull()] }
  }
  private struct Event {
    let code: String
    let attemptId: String
    let packageSha256: String
    var json: [String: String] { ["code": code, "attemptId": attemptId, "packageSha256": packageSha256] }
  }
  private struct Catalogue {
    var schemaVersion: Int = 1
    var current: CodePushVersionReference?
    var previous: CodePushVersionReference?
    var pending: Pending?
    var quarantined: [String] = []
    var activationBlocked = false
    var lastEvent: Event?
    func json(runtime: String) -> [String: Any] {
      var value: [String: Any] = ["schemaVersion": schemaVersion, "nativeRuntimeId": runtime,
        "current": current?.json as Any? ?? NSNull(), "previous": previous?.json as Any? ?? NSNull()]
      if schemaVersion == 2 {
        value["pending"] = pending?.json as Any? ?? NSNull()
        value["quarantined"] = quarantined
        value["activationBlocked"] = activationBlocked
        value["lastEvent"] = lastEvent?.json as Any? ?? NSNull()
      }
      return value
    }
  }

  func select(allowTrial: Bool = false, activationAllowed: () -> Bool = { true }) -> CodePushVersionSelection {
    let localDeadline = deadline()
    func checkBudget() throws {
      try localDeadline()
      if allowTrial { try CodePushManifestValidator.require(activationAllowed(), "startup_timeout") }
    }
    do {
      try checkBudget()
      let paths = try prepare(checkBudget: checkBudget)
      let lock = try acquireLock()
      defer { _ = flock(lock, LOCK_UN); close(lock) }
      try checkBudget()
      var catalogue: Catalogue
      if try !CodePushDownloadFiles.exists(paths.catalogue) {
        try initializeCatalogue(paths.catalogue, checkBudget: checkBudget)
        catalogue = Catalogue()
        if !allowTrial { return .embedded("state_created") }
      } else {
        catalogue = try readCatalogue(paths.catalogue, checkBudget: checkBudget)
      }
      let recovering = catalogue.pending != nil
      if let pending = catalogue.pending {
        catalogue.schemaVersion = 2
        if !catalogue.quarantined.contains(pending.candidate.packageSha256) {
          if catalogue.quarantined.count < 64 { catalogue.quarantined.append(pending.candidate.packageSha256) }
          else { catalogue.activationBlocked = true }
        }
        catalogue.pending = nil
        catalogue.lastEvent = Event(code: "launch_unconfirmed", attemptId: pending.attemptId,
          packageSha256: pending.candidate.packageSha256)
        // Recovery must never cause a new trial in this startup, including a failed write.
        do { try writeCatalogue(catalogue, to: paths.catalogue, operation: "recovery", checkBudget: checkBudget) }
        catch { try checkBudget() }
      }
      let baseline = try verifiedBaseline(catalogue, candidates: paths.candidates, checkBudget: checkBudget)
      try checkBudget()
      if recovering { return withReason(baseline, "launch_unconfirmed") }
      guard allowTrial else { return baseline }
      guard !catalogue.activationBlocked else { return withReason(baseline, "activation_blocked") }
      var unissuedAttempt: String?
      func clearUnissuedPending() {
        guard let attempt = unissuedAttempt,
              catalogue.pending?.attemptId == attempt, catalogue.pending?.processToken == processToken else { return }
        catalogue.pending = nil
        // This selection never reached the JS host. It is neither a crash nor a
        // reason to quarantine the bundle. Storage failures remain conservative.
        try? writeCatalogue(catalogue, to: paths.catalogue, operation: "abandoned_pending", checkBudget: {})
      }
      do {
        guard try CodePushDownloadFiles.exists(paths.runtimeRoot.appendingPathComponent("candidate.json")) else { return baseline }
        let reference = try candidateReference(paths.runtimeRoot)
        try checkBudget()
        if catalogue.current?.packageSha256 == reference.packageSha256
            || catalogue.previous?.packageSha256 == reference.packageSha256 { return baseline }
        try CodePushManifestValidator.require(!catalogue.quarantined.contains(reference.packageSha256), "activation_blocked")
        let manifest = try verify(reference, candidates: paths.candidates, admission: true, checkBudget: checkBudget)
        try validateTrialControls(reference, manifest: manifest, runtimeRoot: paths.runtimeRoot, checkBudget: checkBudget)
        let attemptId = randomAttemptId()
        try CodePushManifestValidator.require(CodePushManifestValidator.matches(attemptId, "[a-f0-9]{32}")
          && CodePushManifestValidator.matches(processToken, "[a-f0-9]{32}"), "state_invalid")
        catalogue.schemaVersion = 2
        catalogue.pending = Pending(attemptId: attemptId, processToken: processToken,
          candidate: reference, fallback: baseline.reference)
        unissuedAttempt = attemptId
        try checkBudget()
        try writeCatalogue(catalogue, to: paths.catalogue, operation: "pending", checkBudget: checkBudget)
        try checkBudget()
        return selection(reference, manifest: manifest, source: "trial", reason: "trial_pending",
          candidates: paths.candidates, attemptId: attemptId)
      } catch let error as CodePushDownloadFailure where error.code == "startup_timeout" {
        clearUnissuedPending()
        return withReason(baseline, "startup_timeout")
      }
      catch let error as CodePushDownloadFailure {
        clearUnissuedPending()
        try checkBudget()
        return withReason(baseline, error.code)
      }
      catch {
        clearUnissuedPending()
        try checkBudget()
        return withReason(baseline, "candidate_invalid")
      }
    } catch let error as CodePushDownloadFailure {
      return .embedded(error.code)
    } catch { return .embedded("storage_unavailable") }
  }

  /// Discards only this process's unexposed attempt after an outer-cache timeout.
  /// A confirmed/current package or somebody else's attempt is never altered.
  func abandonUnissuedTrial(_ selection: CodePushVersionSelection) throws {
    guard selection.source == "trial", selection.processToken == processToken,
          let reference = selection.reference, !selection.attemptId.isEmpty else { return }
    let checkBudget = deadline()
    let paths = try prepare(checkBudget: checkBudget)
    let lock = try acquireLock()
    defer { _ = flock(lock, LOCK_UN); close(lock) }
    var catalogue = try readCatalogue(paths.catalogue, checkBudget: checkBudget)
    guard let pending = catalogue.pending, pending.attemptId == selection.attemptId,
          pending.processToken == processToken, pending.candidate == reference,
          catalogue.current != reference else { return }
    catalogue.pending = nil
    try writeCatalogue(catalogue, to: paths.catalogue, operation: "abandoned_pending", checkBudget: checkBudget)
  }

  /// A snapshot may verify existing files, but never prepares directories,
  /// creates a lock/catalogue, recovers pending, acknowledges, or activates code.
  func diagnostics() -> CodePushStorageDiagnostics {
    var result = CodePushStorageDiagnostics()
    let checkBudget = deadline(milliseconds: 10_000)
    do {
      try checkBudget()
      try CodePushManifestValidator.require(root.isFileURL && runtime.appId == "jaco-driver"
        && runtime.platform == "ios" && CodePushManifestValidator.matches(runtime.nativeRuntimeId, "[a-f0-9]{64}"), "runtime_invalid")
      guard try CodePushDownloadFiles.exists(root.deletingLastPathComponent()) else { return result }
      try CodePushDownloadFiles.requireDirectory(root.deletingLastPathComponent())
      guard try CodePushDownloadFiles.exists(root) else { return result }
      try CodePushDownloadFiles.requireDirectory(root)
      let versionRoot = root.appendingPathComponent("v1", isDirectory: true)
      guard try CodePushDownloadFiles.exists(versionRoot) else { return result }
      try CodePushDownloadFiles.requireDirectory(versionRoot)
      let runtimeRoot = versionRoot.appendingPathComponent(runtime.nativeRuntimeId, isDirectory: true)
      guard try CodePushDownloadFiles.exists(runtimeRoot) else { return result }
      try CodePushDownloadFiles.requireDirectory(runtimeRoot)
      let lockURL = root.appendingPathComponent("manager.lock")
      guard try CodePushDownloadFiles.exists(lockURL) else { return result }
      let lock = try CodePushDownloadFiles.openFile(lockURL, flags: O_RDONLY)
      defer { close(lock) }
      guard flock(lock, LOCK_EX | LOCK_NB) == 0 else {
        result.storageStatus = errno == EWOULDBLOCK || errno == EAGAIN ? "busy" : "invalid"
        result.errorCode = result.storageStatus == "busy" ? "storage_busy" : "state_invalid"
        return result
      }
      defer { _ = flock(lock, LOCK_UN) }
      try checkBudget()
      let candidates = runtimeRoot.appendingPathComponent("candidates", isDirectory: true)
      let catalogueURL = runtimeRoot.appendingPathComponent("versions.json")
      var catalogue: Catalogue?
      if try CodePushDownloadFiles.exists(catalogueURL) {
        do {
          catalogue = try readCatalogue(catalogueURL, checkBudget: checkBudget)
          result.storageStatus = "ready"
        } catch {
          try checkBudget()
          result.storageStatus = "invalid"; result.errorCode = "state_invalid"
        }
      }
      var verified: [String: CodePushDownloadManifest] = [:]
      func inspect(_ reference: CodePushVersionReference) throws -> CodePushDownloadManifest {
        let key = reference.packageSha256 + "-" + reference.payloadSha256
        if let value = verified[key] { return value }
        let value = try verify(reference, candidates: candidates, admission: false, checkBudget: checkBudget)
        verified[key] = value
        return value
      }
      if let catalogue = catalogue {
        result.lastEvent = catalogue.lastEvent?.code ?? ""
        result.lastEventPackageSha256 = catalogue.lastEvent?.packageSha256 ?? ""
        for (reference, current) in [(catalogue.current, true), (catalogue.previous, false)] {
          guard let reference = reference else { continue }
          do {
            let manifest = try inspect(reference)
            if current { result.currentPackageId = manifest.packageId; result.currentVersion = manifest.version }
            else { result.previousPackageId = manifest.packageId; result.previousVersion = manifest.version }
          } catch {
            try checkBudget()
            result.storageStatus = "invalid"; result.errorCode = "state_invalid"
          }
        }
      }
      if try CodePushDownloadFiles.exists(runtimeRoot.appendingPathComponent("candidate.json")) {
        do {
          let manifest = try inspect(candidateReference(runtimeRoot))
          result.candidatePackageId = manifest.packageId; result.candidateVersion = manifest.version
          result.candidateStatus = "ready"
        } catch {
          try checkBudget()
          result.candidateStatus = "invalid"
        }
      }
      try checkBudget()
      return result
    } catch let error as CodePushDownloadFailure {
      result.storageStatus = "invalid"
      result.errorCode = error.code == "startup_timeout" ? "diagnostics_timeout" : "state_invalid"
      return result
    } catch {
      result.storageStatus = "invalid"; result.errorCode = "state_invalid"
      return result
    }
  }

  /// Callers must supply the immutable native binding captured by their module.
  /// A process token or attempt from a different launch never confirms this file.
  func confirm(selection: CodePushVersionSelection, attemptId: String, processToken bindingToken: String,
               bindingValid: () -> Bool = { true }) -> CodePushLaunchResult {
    let checkBudget = deadline()
    do {
      try CodePushManifestValidator.require(bindingValid() && selection.source == "trial" && selection.attemptId == attemptId
        && CodePushManifestValidator.matches(attemptId, "[a-f0-9]{32}")
        && selection.processToken == bindingToken && bindingToken == processToken
        && CodePushManifestValidator.matches(processToken, "[a-f0-9]{32}"), "confirmation_invalid")
      guard let reference = selection.reference else { throw CodePushDownloadFailure("confirmation_invalid") }
      let paths = try prepare(checkBudget: checkBudget)
      let lock: Int32
      do { lock = try acquireLock() }
      catch let error as CodePushDownloadFailure where error.code == "storage_busy" { throw CodePushDownloadFailure("lock_busy") }
      defer { _ = flock(lock, LOCK_UN); close(lock) }
      var catalogue = try readCatalogue(paths.catalogue, checkBudget: checkBudget)
      try CodePushManifestValidator.require(!catalogue.activationBlocked
        && !catalogue.quarantined.contains(reference.packageSha256), "activation_blocked")
      if catalogue.pending == nil && catalogue.current == reference,
         catalogue.lastEvent?.code == "confirmed", catalogue.lastEvent?.attemptId == attemptId,
         catalogue.lastEvent?.packageSha256 == reference.packageSha256 {
        try checkBudget()
        try CodePushManifestValidator.require(bindingValid(), "confirmation_invalid")
        return .selected(selection, runtime: runtime.nativeRuntimeId, status: "confirmed")
      }
      guard let pending = catalogue.pending else { throw CodePushDownloadFailure("confirmation_invalid") }
      try CodePushManifestValidator.require(pending.attemptId == attemptId && pending.processToken == bindingToken
        && pending.candidate == reference && selection.packageId == runtime.nativeRuntimeId + ":" + reference.packageSha256,
        "confirmation_invalid")
      let manifest = try verify(reference, candidates: paths.candidates, admission: false, checkBudget: checkBudget)
      try CodePushManifestValidator.require(manifest.version == selection.version
        && selection.localURL == paths.candidates.appendingPathComponent(reference.packageSha256 + "-" + reference.payloadSha256)
          .appendingPathComponent(manifest.entrypoint), "confirmation_invalid")
      // Only the fallback actually verified when starting the trial can become previous.
      catalogue.schemaVersion = 2
      catalogue.current = reference
      catalogue.previous = pending.fallback
      catalogue.pending = nil
      catalogue.lastEvent = Event(code: "confirmed", attemptId: attemptId, packageSha256: reference.packageSha256)
      try writeCatalogue(catalogue, to: paths.catalogue, operation: "confirm", checkBudget: checkBudget,
        beforeCommit: { try CodePushManifestValidator.require(bindingValid(), "confirmation_invalid") })
      return .selected(selection, runtime: runtime.nativeRuntimeId, status: "confirmed")
    } catch let error as CodePushDownloadFailure {
      let known = ["confirmation_invalid", "state_invalid", "lock_busy", "activation_blocked"]
      return .failure(known.contains(error.code) ? error.code : "confirmation_failed")
    } catch { return .failure("confirmation_failed") }
  }

  /// Record only a fatal error from the confirmed package bound to this process.
  func markFatal(selection: CodePushVersionSelection, bindingToken: String,
                 bindingValid: () -> Bool = { true }) -> Bool {
    let checkBudget = deadline()
    do {
      try CodePushManifestValidator.require(bindingValid() && ["current", "previous", "trial"].contains(selection.source)
        && bindingToken == processToken && CodePushManifestValidator.matches(processToken, "[a-f0-9]{32}"), "fatal_binding_invalid")
      guard let target = selection.reference else { return false }
      try CodePushManifestValidator.require(selection.packageId == runtime.nativeRuntimeId + ":" + target.packageSha256, "fatal_binding_invalid")
      let paths = try prepare(checkBudget: checkBudget)
      let lock = try acquireLock()
      defer { _ = flock(lock, LOCK_UN); close(lock) }
      var catalogue = try readCatalogue(paths.catalogue, checkBudget: checkBudget)
      let runningPrevious = selection.source == "previous"
      try CodePushManifestValidator.require(catalogue.pending == nil && (runningPrevious ? catalogue.previous == target : catalogue.current == target), "fatal_binding_invalid")
      if runningPrevious, let existing = catalogue.current {
        try CodePushManifestValidator.require(try verifiedSelection(existing, source: "current", candidates: paths.candidates, checkBudget: checkBudget) == nil, "fatal_binding_invalid")
      }
      guard let current = try verifiedSelection(target, source: runningPrevious ? "previous" : "current", candidates: paths.candidates, checkBudget: checkBudget) else { return false }
      try CodePushManifestValidator.require(current.localURL == selection.localURL && current.version == selection.version, "fatal_binding_invalid")
      var previous: CodePushVersionReference?
      if !runningPrevious, let reference = catalogue.previous,
         !catalogue.quarantined.contains(reference.packageSha256),
         try verifiedSelection(reference, source: "previous", candidates: paths.candidates, checkBudget: checkBudget) != nil {
        previous = reference
      }
      if !catalogue.quarantined.contains(target.packageSha256) {
        if catalogue.quarantined.count < 64 { catalogue.quarantined.append(target.packageSha256) }
        else { catalogue.activationBlocked = true }
      }
      catalogue.schemaVersion = 2
      catalogue.current = previous
      catalogue.previous = nil
      let eventId = CodePushProcessIdentity.randomToken()
      try CodePushManifestValidator.require(CodePushManifestValidator.matches(eventId, "[a-f0-9]{32}"), "fatal_binding_invalid")
      catalogue.lastEvent = Event(code: "fatal_after_confirmation", attemptId: eventId, packageSha256: target.packageSha256)
      try writeCatalogue(catalogue, to: paths.catalogue, operation: "fatal", checkBudget: checkBudget,
        beforeCommit: { try CodePushManifestValidator.require(bindingValid(), "fatal_binding_invalid") })
      return true
    } catch { return false }
  }

  private func deadline(milliseconds: Int? = nil) -> () throws -> Void {
    let duration = milliseconds ?? budgetMilliseconds
    let maximum = milliseconds == nil ? 1500 : 10_000
    let started = monotonicSeconds()
    let end = started + Double(duration) / 1000
    return { [self] in
      let now = monotonicSeconds()
      try CodePushManifestValidator.require((1...maximum).contains(duration)
        && started.isFinite && now.isFinite && now >= started && now < end, "startup_timeout")
    }
  }

  private struct Paths { let runtimeRoot: URL; let candidates: URL; let catalogue: URL }
  private func prepare(checkBudget: () throws -> Void) throws -> Paths {
    try checkBudget()
    try CodePushManifestValidator.require(root.isFileURL && runtime.appId == "jaco-driver" && runtime.platform == "ios"
      && CodePushManifestValidator.matches(runtime.nativeRuntimeId, "[a-f0-9]{64}")
      && CodePushManifestValidator.matches(runtime.nativeBuild, "[1-9][0-9]{0,18}"), "runtime_invalid")
    try CodePushDownloadFiles.requireDirectory(root.deletingLastPathComponent())
    try CodePushDownloadFiles.directory(root)
    var values = URLResourceValues(); values.isExcludedFromBackup = true
    var resource = root; try resource.setResourceValues(values)
    try checkBudget()
    // Only these exact app-owned paths are created, never package directories.
    let versionRoot = root.appendingPathComponent("v1", isDirectory: true)
    try CodePushDownloadFiles.directory(versionRoot)
    let runtimeRoot = versionRoot.appendingPathComponent(runtime.nativeRuntimeId, isDirectory: true)
    try CodePushDownloadFiles.directory(runtimeRoot)
    try checkBudget()
    return Paths(runtimeRoot: runtimeRoot,
      candidates: runtimeRoot.appendingPathComponent("candidates", isDirectory: true),
      catalogue: runtimeRoot.appendingPathComponent("versions.json"))
  }

  private func acquireLock() throws -> Int32 {
    let descriptor = try CodePushDownloadFiles.openFile(root.appendingPathComponent("manager.lock"), flags: O_RDWR | O_CREAT)
    guard flock(descriptor, LOCK_EX | LOCK_NB) == 0 else {
      let code = errno == EWOULDBLOCK || errno == EAGAIN ? "storage_busy" : "storage_unavailable"
      close(descriptor); throw CodePushDownloadFailure(code)
    }
    return descriptor
  }

  private func verifiedBaseline(_ catalogue: Catalogue, candidates: URL,
                                checkBudget: () throws -> Void) throws -> CodePushVersionSelection {
    guard let current = catalogue.current else { return .embedded("no_confirmed_version") }
    if let value = try verifiedSelection(current, source: "current", candidates: candidates, checkBudget: checkBudget) { return value }
    if let previous = catalogue.previous,
       let value = try verifiedSelection(previous, source: "previous", candidates: candidates, checkBudget: checkBudget) { return value }
    try checkBudget()
    return .embedded("confirmed_version_invalid")
  }

  private func verifiedSelection(_ reference: CodePushVersionReference, source: String, candidates: URL,
                                 checkBudget: () throws -> Void) throws -> CodePushVersionSelection? {
    do {
      let manifest = try verify(reference, candidates: candidates, admission: false, checkBudget: checkBudget)
      return selection(reference, manifest: manifest, source: source,
        reason: source == "current" ? "confirmed_current" : "current_invalid", candidates: candidates)
    } catch let error as CodePushDownloadFailure where error.code == "startup_timeout" { throw error }
    catch { try checkBudget(); return nil }
  }

  private func verify(_ reference: CodePushVersionReference, candidates: URL, admission: Bool,
                      checkBudget: () throws -> Void) throws -> CodePushDownloadManifest {
    try checkBudget()
    try CodePushDownloadFiles.requireDirectory(candidates)
    let directory = candidates.appendingPathComponent(reference.packageSha256 + "-" + reference.payloadSha256, isDirectory: true)
    let manifest = try CodePushCandidateVerifier.verify(directory, runtime: runtime,
      packageSha256: reference.packageSha256, payloadSha256: reference.payloadSha256, verifyEnvelope: verifyEnvelope,
      validatePayload: { [self] in
        if admission { return try CodePushManifestValidator.validate($0, runtime: runtime, nowMilliseconds: nowMilliseconds()) }
        return try CodePushManifestValidator.validateStoredCompatible($0, runtime: runtime)
      }, checkDeadline: checkBudget)
    try checkBudget()
    return manifest
  }

  private func selection(_ reference: CodePushVersionReference, manifest: CodePushDownloadManifest,
                         source: String, reason: String, candidates: URL, attemptId: String = "") -> CodePushVersionSelection {
    CodePushVersionSelection(source: source,
      localURL: candidates.appendingPathComponent(reference.packageSha256 + "-" + reference.payloadSha256)
        .appendingPathComponent(manifest.entrypoint),
      packageId: manifest.packageId, version: manifest.version, reason: reason,
      packageSha256: reference.packageSha256, payloadSha256: reference.payloadSha256, attemptId: attemptId,
      processToken: source == "trial" ? processToken : "")
  }
  private func withReason(_ value: CodePushVersionSelection, _ reason: String) -> CodePushVersionSelection {
    CodePushVersionSelection(source: value.source, localURL: value.localURL, packageId: value.packageId,
      version: value.version, reason: reason, packageSha256: value.packageSha256,
      payloadSha256: value.payloadSha256, attemptId: value.attemptId, processToken: value.processToken)
  }

  private func candidateReference(_ runtimeRoot: URL) throws -> CodePushVersionReference {
    let object = try CodePushManifestValidator.object(CodePushStrictJSON.parse(
      CodePushDownloadFiles.read(runtimeRoot.appendingPathComponent("candidate.json"), limit: 4096), limit: 4096),
      keys: ["packageSha256", "payloadSha256"])
    guard let result = try reference(object) else { throw CodePushDownloadFailure("state_invalid") }
    return result
  }

  private func validateTrialControls(_ reference: CodePushVersionReference, manifest: CodePushDownloadManifest,
                                    runtimeRoot: URL, checkBudget: () throws -> Void) throws {
    let watermark = try CodePushManifestValidator.object(CodePushStrictJSON.parse(
      CodePushDownloadFiles.read(runtimeRoot.appendingPathComponent("watermark.json"), limit: 4096), limit: 4096),
      keys: ["schemaVersion", "manifestSequence", "payloadSha256"])
    _ = try CodePushManifestValidator.integer(watermark["schemaVersion"], min: 1, max: 1)
    try CodePushManifestValidator.require(try CodePushManifestValidator.integer(watermark["manifestSequence"], min: 1,
      max: CodePushManifestValidator.maximumSafeInteger) == manifest.sequence
      && watermark["payloadSha256"] as? String == reference.payloadSha256 && manifest.enabled, "activation_blocked")
    let install = try CodePushManifestValidator.object(CodePushStrictJSON.parse(
      CodePushDownloadFiles.read(root.appendingPathComponent("install-id.json"), limit: 4096), limit: 4096),
      keys: ["schemaVersion", "installId"])
    _ = try CodePushManifestValidator.integer(install["schemaVersion"], min: 1, max: 1)
    let id = try CodePushManifestValidator.text(install["installId"], pattern: "[a-f0-9]{32}")
    try CodePushManifestValidator.require(CodePushDownloadManager.rolloutSlot(installId: id, appId: runtime.appId,
      seed: manifest.rolloutSeed) < manifest.rolloutBasisPoints, "activation_blocked")
    try checkBudget()
  }

  private func readCatalogue(_ url: URL, checkBudget: () throws -> Void) throws -> Catalogue {
    do {
      let bytes = try CodePushDownloadFiles.read(url, limit: 16 * 1024)
      try checkBudget()
      guard let raw = try CodePushStrictJSON.parse(bytes, limit: 16 * 1024) as? [String: Any] else { throw CodePushDownloadFailure("state_invalid") }
      let schema = try CodePushManifestValidator.integer(raw["schemaVersion"], min: 1, max: 2)
      let object = try CodePushManifestValidator.object(raw, keys: schema == 1
        ? ["schemaVersion", "nativeRuntimeId", "current", "previous"]
        : ["schemaVersion", "nativeRuntimeId", "current", "previous", "pending", "quarantined", "activationBlocked", "lastEvent"])
      try CodePushManifestValidator.require(object["nativeRuntimeId"] as? String == runtime.nativeRuntimeId, "state_invalid")
      var catalogue = Catalogue(schemaVersion: Int(schema), current: try reference(object["current"]), previous: try reference(object["previous"]))
      try CodePushManifestValidator.require(catalogue.current != nil || catalogue.previous == nil, "state_invalid")
      try CodePushManifestValidator.require(catalogue.current == nil || catalogue.current != catalogue.previous, "state_invalid")
      if schema == 2 {
        guard let quarantined = object["quarantined"] as? [String], quarantined.count <= 64,
              Set(quarantined).count == quarantined.count,
              quarantined.allSatisfy({ CodePushManifestValidator.matches($0, "[a-f0-9]{64}") }),
              let blocked = object["activationBlocked"] as? NSNumber,
              CFGetTypeID(blocked) == CFBooleanGetTypeID() else { throw CodePushDownloadFailure("state_invalid") }
        catalogue.quarantined = quarantined; catalogue.activationBlocked = blocked.boolValue
        if !(object["pending"] is NSNull) {
          let record = try CodePushManifestValidator.object(object["pending"], keys: ["attemptId", "processToken", "candidate", "fallback"])
          guard let candidate = try reference(record["candidate"]) else { throw CodePushDownloadFailure("state_invalid") }
          let fallback = try reference(record["fallback"])
          try CodePushManifestValidator.require(candidate.packageSha256 != catalogue.current?.packageSha256
            && candidate.packageSha256 != catalogue.previous?.packageSha256
            && (fallback == nil || fallback == catalogue.current || fallback == catalogue.previous), "state_invalid")
          catalogue.pending = Pending(attemptId: try CodePushManifestValidator.text(record["attemptId"], pattern: "[a-f0-9]{32}"),
            processToken: try CodePushManifestValidator.text(record["processToken"], pattern: "[a-f0-9]{32}"),
            candidate: candidate, fallback: fallback)
        }
        if !(object["lastEvent"] is NSNull) {
          let event = try CodePushManifestValidator.object(object["lastEvent"], keys: ["code", "attemptId", "packageSha256"])
          catalogue.lastEvent = Event(code: try CodePushManifestValidator.text(event["code"], pattern: "(?:confirmed|launch_unconfirmed|fatal_after_confirmation)"),
            attemptId: try CodePushManifestValidator.text(event["attemptId"], pattern: "[a-f0-9]{32}"),
            packageSha256: try CodePushManifestValidator.text(event["packageSha256"], pattern: "[a-f0-9]{64}"))
        }
      }
      try checkBudget()
      return catalogue
    } catch let error as CodePushDownloadFailure where error.code == "startup_timeout" { throw error }
    catch { try checkBudget(); throw CodePushDownloadFailure("state_invalid") }
  }

  private func reference(_ value: Any?) throws -> CodePushVersionReference? {
    if value is NSNull { return nil }
    let object = try CodePushManifestValidator.object(value, keys: ["packageSha256", "payloadSha256"])
    return CodePushVersionReference(packageSha256: try CodePushManifestValidator.text(object["packageSha256"], pattern: "[a-f0-9]{64}"),
      payloadSha256: try CodePushManifestValidator.text(object["payloadSha256"], pattern: "[a-f0-9]{64}"))
  }

  private func writeCatalogue(_ catalogue: Catalogue, to destination: URL, operation: String,
                              checkBudget: () throws -> Void, beforeCommit: () throws -> Void = {}) throws {
    try checkBudget()
    try fault("before_" + operation + "_write")
    // Preserve the same hardlink/symlink checks as reads before replacing a record.
    let descriptor = try CodePushDownloadFiles.openFile(destination, flags: O_RDONLY); close(descriptor)
    let temporary = destination.deletingLastPathComponent().appendingPathComponent(".record-" + UUID().uuidString.lowercased())
    defer { _ = unlink(temporary.path) }
    try CodePushDownloadFiles.newFile(JSONSerialization.data(withJSONObject: catalogue.json(runtime: runtime.nativeRuntimeId), options: [.sortedKeys]), at: temporary)
    try fault("before_" + operation + "_rename")
    try checkBudget()
    try beforeCommit()
    try CodePushManifestValidator.require(rename(temporary.path, destination.path) == 0, "io_error")
    try CodePushDownloadFiles.syncDirectory(destination.deletingLastPathComponent())
    try fault("after_" + operation + "_rename")
    try checkBudget()
  }

  private func initializeCatalogue(_ destination: URL, checkBudget: () throws -> Void) throws {
    let data = try JSONSerialization.data(withJSONObject: Catalogue().json(runtime: runtime.nativeRuntimeId), options: [.sortedKeys])
    let temporary = destination.deletingLastPathComponent().appendingPathComponent(".record-" + UUID().uuidString.lowercased())
    defer { _ = unlink(temporary.path) }
    try fault("before_catalog_write"); try checkBudget()
    try CodePushDownloadFiles.newFile(data, at: temporary)
    try fault("before_catalog_rename"); try checkBudget()
    let moved = temporary.path.withCString { source in destination.path.withCString { target in
      renamex_np(source, target, UInt32(RENAME_EXCL))
    } }
    try CodePushManifestValidator.require(moved == 0, "state_invalid")
    try CodePushDownloadFiles.syncDirectory(destination.deletingLastPathComponent())
    try fault("after_catalog_rename"); try checkBudget()
  }
}
