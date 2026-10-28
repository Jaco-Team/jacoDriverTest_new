import Foundation

/// Shared deadline and cancellation for one native opening. Only a verified
/// non-trial selection may become the fallback for a timed-out network check.
final class CodePushStartupSelectionContext {
  private let lock = NSLock()
  private let started: TimeInterval
  private let deadline: TimeInterval
  private let monotonicSeconds: () -> TimeInterval
  private var settled = false
  private var accepted = false
  private var baseline = CodePushVersionSelection.embedded("startup_timeout")
  private var discardTrial: (() -> Void)?

  init(started: TimeInterval, budgetSeconds: TimeInterval,
       monotonicSeconds: @escaping () -> TimeInterval) {
    self.started = started
    deadline = started + budgetSeconds
    self.monotonicSeconds = monotonicSeconds
  }

  var isActive: Bool {
    lock.lock(); defer { lock.unlock() }
    let now = monotonicSeconds()
    return !settled && started.isFinite && now.isFinite && now >= started && now < deadline
  }

  func remaining(reserving seconds: TimeInterval = 0) -> TimeInterval {
    lock.lock(); defer { lock.unlock() }
    let now = monotonicSeconds()
    guard !settled && started.isFinite && now.isFinite && now >= started else { return 0 }
    return max(0, deadline - now - seconds)
  }

  func publishBaseline(_ selection: CodePushVersionSelection) {
    guard ["embedded", "current", "previous"].contains(selection.source), selection.attemptId.isEmpty else { return }
    lock.lock(); defer { lock.unlock() }
    if !settled && (selection.source != "embedded" || baseline.source == "embedded") { baseline = selection }
  }

  func onDiscardTrial(_ action: @escaping () -> Void) {
    lock.lock()
    let discardNow = settled && !accepted
    if !settled { discardTrial = action }
    lock.unlock()
    // Registration happens after select released its storage lock.
    if discardNow { action() }
  }

  func finish(accepting: Bool) -> (fallback: CodePushVersionSelection, discard: (() -> Void)?) {
    lock.lock()
    var discard: (() -> Void)?
    if !settled {
      settled = true
      accepted = accepting
      if !accepting { discard = discardTrial }
      discardTrial = nil
    }
    var fallback = baseline
    fallback = CodePushVersionSelection(source: fallback.source, localURL: fallback.localURL,
      packageId: fallback.packageId, version: fallback.version, reason: "startup_timeout",
      packageSha256: fallback.packageSha256, payloadSha256: fallback.payloadSha256)
    lock.unlock()
    return (fallback, discard)
  }
}

/// One immutable startup choice. Late completion cannot replace a frozen host.
final class CodePushStartupSelectionCache {
  private final class Pending {
    let group = DispatchGroup()
    let lock = NSLock()
    let started: TimeInterval
    let context: CodePushStartupSelectionContext
    var completed: TimeInterval?
    var result: CodePushVersionSelection?
    init(started: TimeInterval, context: CodePushStartupSelectionContext) {
      self.started = started; self.context = context; group.enter()
    }
  }

  private let lock = NSLock()
  private let select: (CodePushStartupSelectionContext) -> CodePushVersionSelection
  private let monotonicSeconds: () -> TimeInterval
  private let waitMilliseconds: Int
  private var pending: Pending?
  private var cached: CodePushVersionSelection?

  init(waitMilliseconds: Int = 2000,
       monotonicSeconds: @escaping () -> TimeInterval = { ProcessInfo.processInfo.systemUptime },
       select: @escaping () -> CodePushVersionSelection) {
    self.waitMilliseconds = waitMilliseconds
    self.monotonicSeconds = monotonicSeconds
    self.select = { _ in select() }
  }

  init(waitMilliseconds: Int = 10000,
       monotonicSeconds: @escaping () -> TimeInterval = { ProcessInfo.processInfo.systemUptime },
       selectWithContext: @escaping (CodePushStartupSelectionContext) -> CodePushVersionSelection) {
    self.waitMilliseconds = waitMilliseconds
    self.monotonicSeconds = monotonicSeconds
    select = selectWithContext
  }

  func selection(enabled: Bool = true) -> CodePushVersionSelection {
    guard enabled else { return .embedded("debug") }
    lock.lock()
    if let cached = cached { lock.unlock(); return cached }
    let work: Pending
    if let pending = pending {
      work = pending
    } else {
      let started = monotonicSeconds()
      guard started.isFinite, (1...10000).contains(waitMilliseconds) else {
        let fallback = CodePushVersionSelection.embedded("startup_timeout")
        cached = fallback
        lock.unlock()
        return fallback
      }
      let context = CodePushStartupSelectionContext(started: started,
        budgetSeconds: Double(waitMilliseconds) / 1000, monotonicSeconds: monotonicSeconds)
      work = Pending(started: started, context: context)
      pending = work
      DispatchQueue.global(qos: .userInitiated).async { [self, work] in
        let choice = select(work.context)
        work.lock.lock()
        work.result = choice
        work.completed = monotonicSeconds()
        work.lock.unlock()
        work.group.leave()
      }
    }
    lock.unlock()
    let budget = Double(max(0, waitMilliseconds)) / 1000
    let now = monotonicSeconds()
    let validClock = now.isFinite && now >= work.started
    let remaining = validClock ? min(budget, max(0, work.started + budget - now)) : 0
    _ = work.group.wait(timeout: .now() + remaining)
    work.lock.lock()
    let completed = work.completed
    let result = work.result
    work.lock.unlock()
    let inTime = completed.map { $0.isFinite && work.started.isFinite && $0 >= work.started && $0 - work.started < budget } ?? false
    // Completion time, rather than the caller's wake-up time, decides acceptance.
    let accept = inTime && validClock && result != nil
    lock.lock()
    if let cached = cached { lock.unlock(); return cached }
    let settlement = work.context.finish(accepting: accept)
    let proposed = accept ? result! : settlement.fallback
    cached = proposed
    lock.unlock()
    // File IO is never called while holding the cache/context locks or awaited
    // by the UI thread after a discarded selection.
    if let discard = settlement.discard { DispatchQueue.global(qos: .utility).async(execute: discard) }
    return proposed
  }

  func peek() -> CodePushVersionSelection? {
    lock.lock(); defer { lock.unlock() }
    return cached
  }

  /// Used only by the preflight cache, which never prepares a trial.
  func cancelPreflight() -> CodePushVersionSelection? {
    lock.lock()
    if let cached = cached { lock.unlock(); return cached }
    guard let pending = pending else { lock.unlock(); return nil }
    let settlement = pending.context.finish(accepting: false)
    cached = settlement.fallback
    lock.unlock()
    if let discard = settlement.discard { DispatchQueue.global(qos: .utility).async(execute: discard) }
    return settlement.fallback
  }
}

/// Background-only preflight. It deliberately never records a pending trial:
/// only the actual RN bundle request may authorize execution of a candidate.
final class CodePushColdStartPreflight {
  private let baseline: (CodePushStartupSelectionContext) -> CodePushVersionSelection
  private let download: (TimeInterval, CodePushStartupSelectionContext) -> CodePushDownloadResult

  init(baseline: @escaping (CodePushStartupSelectionContext) -> CodePushVersionSelection,
       download: @escaping (TimeInterval, CodePushStartupSelectionContext) -> CodePushDownloadResult) {
    self.baseline = baseline; self.download = download
  }

  func run(context: CodePushStartupSelectionContext, permitted: () -> Bool = { true }) -> CodePushVersionSelection {
    let baseline = self.baseline(context)
    context.publishBaseline(baseline)
    guard permitted(), baseline.reason != "launch_unconfirmed", context.isActive else { return baseline }
    // The caller waits at most eight seconds, but a slow verified download may
    // finish within its normal 120-second operation budget for the next opening.
    // This worker never selects a trial or changes the already frozen host.
    _ = download(120, context)
    return baseline
  }
}

/// Connection metadata classifies provenance; a separate foreground callback
/// supplies readiness. Transient UIKit background values in willConnect do not.
enum CodePushSceneEntryPolicy {
  static func isOrdinary(windowApplication: Bool, applicationLaunchKeys: Set<String>,
                         hasURL: Bool, hasUserActivity: Bool, hasNotification: Bool,
                         hasShortcut: Bool) -> Bool {
    let externalKeys: Set<String> = [
      "UIApplicationLaunchOptionsURLKey", "UIApplicationLaunchOptionsSourceApplicationKey",
      "UIApplicationLaunchOptionsUserActivityDictionaryKey", "UIApplicationLaunchOptionsRemoteNotificationKey",
      "UIApplicationLaunchOptionsLocalNotificationKey", "UIApplicationLaunchOptionsLocationKey",
      "UIApplicationLaunchOptionsBluetoothCentralsKey", "UIApplicationLaunchOptionsBluetoothPeripheralsKey",
      "UIApplicationLaunchOptionsShortcutItemKey",
    ]
    return windowApplication && applicationLaunchKeys.isDisjoint(with: externalKeys)
      && !hasURL && !hasUserActivity && !hasNotification && !hasShortcut
  }
}

struct CodePushLaunchBinding {
  let selection: CodePushVersionSelection
  let nativeRuntimeId: String
  let processToken: String
  let errorCode: String
}

enum CodePushDiagnostics {
  static func empty(applicationIdentifier: String = "", nativeBuild: String = "") -> [String: String] {
    ["status": "error", "errorCode": "runtime_invalid", "applicationIdentifier": applicationIdentifier,
     "nativeBuild": nativeBuild, "nativeRuntimeId": "", "source": "", "launchStatus": "error",
     "launchReason": "runtime_invalid", "launchedPackageId": "", "launchedVersion": "",
     "currentPackageId": "", "currentVersion": "", "previousPackageId": "", "previousVersion": "",
     "candidatePackageId": "", "candidateVersion": "", "candidateStatus": "none", "lastEvent": "",
     "lastEventPackageSha256": "", "downloadStatus": "not_checked", "downloadErrorCode": "",
     "downloadPackageId": "", "downloadVersion": "", "storageStatus": "missing"]
  }

  static func snapshot(runtime: CodePushNativeRuntimeContext, binding: CodePushLaunchBinding,
                       confirmed: Bool, storage: CodePushStorageDiagnostics,
                       download: CodePushDownloadResult) -> [String: String] {
    var value = empty(applicationIdentifier: runtime.applicationIdentifier, nativeBuild: runtime.nativeBuild)
    let debug = binding.errorCode == "debug_disabled"
    let error = !binding.errorCode.isEmpty && !debug ? binding.errorCode : storage.errorCode
    value["status"] = error.isEmpty ? "ready" : "error"
    value["errorCode"] = error
    value["nativeRuntimeId"] = runtime.nativeRuntimeId
    value["source"] = debug ? "metro" : binding.selection.source
    value["launchStatus"] = debug ? "debug" : (!binding.errorCode.isEmpty ? "error" : (confirmed ? "confirmed" : "running"))
    value["launchReason"] = CodePushManifestValidator.matches(binding.selection.reason, "[a-z][a-z0-9_]{0,63}")
      ? binding.selection.reason : "unavailable"
    value["launchedPackageId"] = binding.selection.packageId; value["launchedVersion"] = binding.selection.version
    value["currentPackageId"] = storage.currentPackageId; value["currentVersion"] = storage.currentVersion
    value["previousPackageId"] = storage.previousPackageId; value["previousVersion"] = storage.previousVersion
    value["candidatePackageId"] = storage.candidatePackageId; value["candidateVersion"] = storage.candidateVersion
    value["candidateStatus"] = storage.candidateStatus; value["lastEvent"] = storage.lastEvent
    value["lastEventPackageSha256"] = storage.lastEventPackageSha256
    value["downloadStatus"] = download.status; value["downloadErrorCode"] = download.errorCode
    value["downloadPackageId"] = download.packageId; value["downloadVersion"] = download.version
    value["storageStatus"] = storage.storageStatus
    return value
  }
}

/// Captures launch provenance before dispatching storage work, so an early
/// background/default request cannot acquire permission from a later UI scene.
final class CodePushStartupProvenance {
  private let lock = NSLock()
  private let select: (Bool, CodePushStartupSelectionContext) -> CodePushVersionSelection
  private let waitMilliseconds: Int
  private var normalUIStartAllowed = false
  private var cache: CodePushStartupSelectionCache?

  init(select: @escaping (Bool) -> CodePushVersionSelection) {
    self.select = { allowed, _ in select(allowed) }; waitMilliseconds = 2000
  }

  init(waitMilliseconds: Int = 10000,
       selectWithContext: @escaping (Bool, CodePushStartupSelectionContext) -> CodePushVersionSelection) {
    self.select = selectWithContext; self.waitMilliseconds = waitMilliseconds
  }

  func markNormalUIStart(_ eligible: Bool) {
    lock.lock(); defer { lock.unlock() }
    guard cache == nil else { return }
    normalUIStartAllowed = eligible
  }

  func selection() -> CodePushVersionSelection {
    lock.lock()
    let selectedCache: CodePushStartupSelectionCache
    if let existing = cache { selectedCache = existing }
    else {
      let allowed = normalUIStartAllowed
      let operation = select
      let created = CodePushStartupSelectionCache(waitMilliseconds: waitMilliseconds,
        selectWithContext: { operation(allowed, $0) })
      cache = created
      selectedCache = created
    }
    lock.unlock()
    return selectedCache.selection()
  }
}

enum CodePushStartup {
  private static let entryLock = NSLock()
  private static var ordinaryRevoked = false
  private static var isOrdinaryRevoked: Bool {
    entryLock.lock(); defer { entryLock.unlock() }
    return ordinaryRevoked
  }
  private static let preflight = CodePushColdStartPreflight(baseline: { _ in
    do { return try makeStore().select(allowTrial: false) }
    catch { return .embedded("runtime_invalid") }
  }, download: { timeout, _ in
    do {
      let runtime = try CodePushNativeEnvironment.loadRuntimeContext().get()
      let root = try storageRoot()
      return CodePushDownloadManager(rootURL: root, runtime: runtime,
        verifyEnvelope: { try CodePushNativeEnvironment.verifyManifest($0).get() },
        dependencies: CodePushDownloadDependencies(transport: CodePushURLSessionTransport()))
        .checkAndDownload(timeoutSeconds: timeout, isActive: { !isOrdinaryRevoked })
    } catch {
      let result = CodePushDownloadResult(status: "error", errorCode: "runtime_invalid", packageId: "",
        version: "", nativeRuntimeId: "", packageSha256: "")
      CodePushDownloadHistory.shared.finish(result)
      return result
    }
  })
  private static let preflightCache = CodePushStartupSelectionCache(waitMilliseconds: 8000, selectWithContext: {
    preflight.run(context: $0, permitted: { !isOrdinaryRevoked })
  })
  private static let provenance = CodePushStartupProvenance(waitMilliseconds: 2000, selectWithContext: { allowed, context in
    do {
      let baseline = try preflightCache.peek() ?? makeStore().select(allowTrial: false)
      context.publishBaseline(baseline)
      let status = CodePushDownloadHistory.shared.snapshot().status
      guard allowed && !isOrdinaryRevoked && preflightCache.peek() != nil
          && !["launch_unconfirmed", "startup_timeout"].contains(baseline.reason)
          && ["downloaded", "already_downloaded", "error"].contains(status)
          && context.isActive else { return baseline }
      let store = try makeStore()
      let choice = store.select(allowTrial: true, activationAllowed: { context.isActive && !isOrdinaryRevoked })
      if choice.source == "trial" {
        context.onDiscardTrial { try? store.abandonUnissuedTrial(choice) }
        return choice
      }
      if choice.source == "embedded", ["startup_timeout", "lock_busy"].contains(choice.reason),
         ["current", "previous"].contains(baseline.source) {
        return CodePushVersionSelection(source: baseline.source, localURL: baseline.localURL,
          packageId: baseline.packageId, version: baseline.version, reason: choice.reason,
          packageSha256: baseline.packageSha256, payloadSha256: baseline.payloadSha256)
      }
      return choice
    } catch { return .embedded("runtime_invalid") }
  })

  /// SceneDelegate shows the native launch screen while this bounded work runs.
  /// No candidate is marked pending until the actual bundleURL request below.
  static func prepareForNormalUI(completion: @escaping () -> Void) {
    #if DEBUG
      DispatchQueue.main.async(execute: completion)
    #else
      DispatchQueue.global(qos: .userInitiated).async {
        _ = preflightCache.selection()
        DispatchQueue.main.async(execute: completion)
      }
    #endif
  }

  static func restrictToExistingCode() {
    entryLock.lock(); ordinaryRevoked = true; entryLock.unlock()
    _ = preflightCache.cancelPreflight()
  }

  /// SceneDelegate calls this before creating React Native. A prior selection is
  /// frozen even if an ordinary UI scene is attached later in the same process.
  static func markNormalUIStart(_ eligible: Bool) { provenance.markNormalUIStart(eligible) }
  private static func selection() -> CodePushVersionSelection { provenance.selection() }

  private static func storageRoot() throws -> URL {
    guard let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
      throw CodePushDownloadFailure("storage_unavailable")
    }
    try FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
    try CodePushDownloadFiles.requireDirectory(support)
    return support.appendingPathComponent("codepush", isDirectory: true)
  }

  private static func makeStore() throws -> CodePushVersionStore {
    let runtime = try CodePushNativeEnvironment.loadRuntimeContext().get()
    return CodePushVersionStore(rootURL: try storageRoot(),
      runtime: runtime, verifyEnvelope: { try CodePushNativeEnvironment.verifyManifest($0).get() })
  }

  static func bundleURL(embeddedURL: URL?) -> URL? {
    #if DEBUG
      return embeddedURL
    #else
      return selection().localURL ?? embeddedURL
    #endif
  }

  static func captureBinding() -> CodePushLaunchBinding {
    #if DEBUG
      return CodePushLaunchBinding(selection: .embedded("debug"), nativeRuntimeId: "",
        processToken: CodePushProcessIdentity.token, errorCode: "debug_disabled")
    #else
      let choice = selection()
      do {
        let runtime = try CodePushNativeEnvironment.loadRuntimeContext().get()
        return CodePushLaunchBinding(selection: choice, nativeRuntimeId: runtime.nativeRuntimeId,
          processToken: CodePushProcessIdentity.token, errorCode: "")
      } catch {
        return CodePushLaunchBinding(selection: .embedded("runtime_invalid"), nativeRuntimeId: "",
          processToken: CodePushProcessIdentity.token, errorCode: "runtime_invalid")
      }
    #endif
  }

  static func launchState(_ binding: CodePushLaunchBinding) -> CodePushLaunchResult {
    guard binding.errorCode.isEmpty else { return .failure(binding.errorCode) }
    return .selected(binding.selection, runtime: binding.nativeRuntimeId)
  }

  static func diagnostics(_ binding: CodePushLaunchBinding, confirmed: Bool) -> [String: String] {
    do {
      let runtime = try CodePushNativeEnvironment.loadRuntimeContext().get()
      guard binding.errorCode == "debug_disabled" || binding.nativeRuntimeId == runtime.nativeRuntimeId else {
        return CodePushDiagnostics.empty(applicationIdentifier: runtime.applicationIdentifier, nativeBuild: runtime.nativeBuild)
      }
      let storage: CodePushStorageDiagnostics
      if let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first {
        storage = CodePushVersionStore(rootURL: support.appendingPathComponent("codepush", isDirectory: true),
          runtime: runtime, verifyEnvelope: { try CodePushNativeEnvironment.verifyManifest($0).get() }).diagnostics()
      } else {
        var missing = CodePushStorageDiagnostics(); missing.errorCode = "storage_unavailable"; missing.storageStatus = "invalid"
        storage = missing
      }
      return CodePushDiagnostics.snapshot(runtime: runtime, binding: binding, confirmed: confirmed,
        storage: storage, download: CodePushDownloadHistory.shared.snapshot())
    } catch {
      return CodePushDiagnostics.empty(applicationIdentifier: Bundle.main.bundleIdentifier ?? "",
        nativeBuild: Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "")
    }
  }

  static func markFatal(_ binding: CodePushLaunchBinding, bindingValid: @escaping () -> Bool) -> Bool {
    #if DEBUG
      return false
    #else
      guard bindingValid(), binding.errorCode.isEmpty,
            binding.processToken == CodePushProcessIdentity.token else { return false }
      do {
        let runtime = try CodePushNativeEnvironment.loadRuntimeContext().get()
        guard runtime.nativeRuntimeId == binding.nativeRuntimeId else { return false }
        return try makeStore().markFatal(selection: binding.selection, bindingToken: binding.processToken,
          bindingValid: bindingValid)
      } catch { return false }
    #endif
  }

  static func confirm(_ binding: CodePushLaunchBinding, attemptId: String,
                      bindingValid: () -> Bool = { true }) -> CodePushLaunchResult {
    guard binding.errorCode.isEmpty else { return .failure(binding.errorCode) }
    guard bindingValid() && binding.nativeRuntimeId.count == 64 && binding.processToken == CodePushProcessIdentity.token else {
      return .failure("confirmation_invalid")
    }
    do {
      let runtime = try CodePushNativeEnvironment.loadRuntimeContext().get()
      guard runtime.nativeRuntimeId == binding.nativeRuntimeId else { return .failure("confirmation_invalid") }
      return try makeStore().confirm(selection: binding.selection, attemptId: attemptId,
        processToken: binding.processToken, bindingValid: bindingValid)
    } catch { return .failure("confirmation_failed") }
  }
}
