import Foundation

@objc(JacoCodePushBridge)
final class JacoCodePushBridge: NSObject {
  private let binding: CodePushLaunchBinding
  private let stateLock = NSLock()
  // A diagnostic hash must finish before this instance attempts its nonblocking
  // confirmation lock; its time does not consume the confirmation's own budget.
  private let lifecycleQueue = DispatchQueue(label: "JacoCodePush-lifecycle", qos: .utility)
  private var confirmed = false
  private var invalidated = false

  @objc func invalidate() {
    stateLock.lock(); invalidated = true; stateLock.unlock()
  }

  private func bindingIsValid() -> Bool {
    stateLock.lock(); defer { stateLock.unlock() }
    return !invalidated
  }

  override init() {
    binding = CodePushStartup.captureBinding()
    super.init()
  }

  @objc(getLaunchStateWithCompletion:)
  func getLaunchState(completion: @escaping ([String: String]) -> Void) {
    let result = CodePushStartup.launchState(binding)
    stateLock.lock()
    let didConfirm = confirmed
    stateLock.unlock()
    if didConfirm && result.status == "running" {
      completion(CodePushLaunchResult(status: "confirmed", errorCode: result.errorCode,
        packageId: result.packageId, version: result.version, nativeRuntimeId: result.nativeRuntimeId,
        attemptId: result.attemptId, source: result.source).dictionary)
    } else { completion(result.dictionary) }
  }

  @objc(getDiagnosticsWithCompletion:)
  func getDiagnostics(completion: @escaping ([String: String]) -> Void) {
    let immutableBinding = binding
    lifecycleQueue.async { [self] in
      guard bindingIsValid() else {
        var result = CodePushDiagnostics.empty()
        result["errorCode"] = "module_invalidated"
        result["launchReason"] = "module_invalidated"
        result["storageStatus"] = "invalid"
        completion(result)
        return
      }
      stateLock.lock(); let didConfirm = confirmed; stateLock.unlock()
      completion(CodePushStartup.diagnostics(immutableBinding, confirmed: didConfirm))
    }
  }

  @objc(confirmLaunch:completion:)
  func confirmLaunch(_ attemptId: String, completion: @escaping ([String: String]) -> Void) {
    let immutableBinding = binding
    lifecycleQueue.async { [self] in
      let result = CodePushStartup.confirm(immutableBinding, attemptId: attemptId,
        bindingValid: { self.bindingIsValid() })
      if result.status == "confirmed" && result.attemptId == immutableBinding.selection.attemptId {
        stateLock.lock(); confirmed = true; stateLock.unlock()
      }
      completion(result.dictionary)
    }
  }

  @objc(markFatalWithCompletion:)
  func markFatal(completion: @escaping (Bool) -> Void) {
    let immutableBinding = binding
    lifecycleQueue.async { [self] in
      completion(CodePushStartup.markFatal(immutableBinding, bindingValid: { self.bindingIsValid() }))
    }
  }

  @objc(checkAndDownloadWithCompletion:)
  static func checkAndDownload(completion: @escaping ([String: String]) -> Void) {
    CodePushDownloadHistory.shared.begin()
    DispatchQueue.global(qos: .utility).async {
      do {
        let runtime = try CodePushNativeEnvironment.loadRuntimeContext().get()
        let transport = CodePushURLSessionTransport()
        guard let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
          throw CodePushDownloadFailure("io_error")
        }
        // Only the application's existing Application Support parent may need creation.
        // The private updater subtree itself is checked component-by-component in core.
        try FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        let manager = CodePushDownloadManager(rootURL: support.appendingPathComponent("codepush", isDirectory: true),
          runtime: runtime, verifyEnvelope: { try CodePushNativeEnvironment.verifyManifest($0).get() },
          dependencies: CodePushDownloadDependencies(transport: transport))
        completion(manager.checkAndDownload().dictionary)
      } catch let error as CodePushManifestVerificationError {
        completion(failure(error.rawValue))
      } catch let error as CodePushDownloadFailure {
        completion(failure(error.code))
      } catch {
        completion(failure("io_error"))
      }
    }
  }

  private static func failure(_ code: String) -> [String: String] {
    let result = CodePushDownloadResult(status: "error", errorCode: code, packageId: "", version: "",
      nativeRuntimeId: "", packageSha256: "")
    CodePushDownloadHistory.shared.finish(result)
    return result.dictionary
  }
}
