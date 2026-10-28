import Foundation

/// One ephemeral streaming data task per fetch. No redirects, credential storage,
/// cookies, disk cache, retries in this layer, or unbounded URLSession download files.
final class CodePushURLSessionTransport: CodePushDownloadTransport {
  func fetch(_ url: String, maxBytes: Int64, timeoutSeconds: TimeInterval,
             consume: @escaping (Data) throws -> Void) throws -> CodePushHTTPResponse {
    guard let requested = URL(string: url), requested.scheme == "https",
          requested.host == "storage.yandexcloud.net", requested.user == nil,
          requested.password == nil, requested.port == nil, requested.fragment == nil,
          requested.absoluteString == url else { throw CodePushDownloadFailure("url_invalid") }
    let configuration = URLSessionConfiguration.ephemeral
    configuration.urlCache = nil
    configuration.urlCredentialStorage = nil
    configuration.httpCookieStorage = nil
    configuration.httpShouldSetCookies = false
    configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
    configuration.timeoutIntervalForRequest = 30
    guard timeoutSeconds.isFinite && timeoutSeconds > 0 else { throw CodePushDownloadFailure("network_timeout") }
    let budget = min(120, timeoutSeconds)
    configuration.timeoutIntervalForResource = budget
    configuration.waitsForConnectivity = false
    let delegate = StreamDelegate(url: url, limit: maxBytes, consume: consume)
    let queue = OperationQueue()
    queue.maxConcurrentOperationCount = 1
    let session = URLSession(configuration: configuration, delegate: delegate, delegateQueue: queue)
    defer { session.invalidateAndCancel() }
    var request = URLRequest(url: requested, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
    request.httpShouldHandleCookies = false
    request.setValue("identity", forHTTPHeaderField: "Accept-Encoding")
    let task = session.dataTask(with: request)
    // URLSession has one idle/request timeout rather than separate socket connect
    // and read values. Enforce 15s to the first HTTP response, 30s request idle,
    // and 120s for this entire operation, including cancellation.
    let firstResponse = DispatchWorkItem { delegate.cancelIfAwaitingResponse(task) }
    DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + min(15, budget), execute: firstResponse)
    defer { firstResponse.cancel() }
    task.resume()
    if delegate.finished.wait(timeout: .now() + budget) == .timedOut {
      delegate.stop(CodePushDownloadFailure("network_timeout"))
      task.cancel()
    }
    return try delegate.result()
  }

  private final class StreamDelegate: NSObject, URLSessionDataDelegate, @unchecked Sendable {
    let finished = DispatchSemaphore(value: 0)
    private let lock = NSLock()
    private let url: String
    private let limit: Int64
    private let consume: (Data) throws -> Void
    private var response: CodePushHTTPResponse?
    private var count: Int64 = 0
    private var failure: Error?
    private var stopped = false

    init(url: String, limit: Int64, consume: @escaping (Data) throws -> Void) {
      self.url = url; self.limit = limit; self.consume = consume
    }

    func result() throws -> CodePushHTTPResponse {
      lock.lock(); defer { lock.unlock() }
      if let failure = failure { throw failure }
      guard stopped, let response = response else { throw CodePushDownloadFailure("network_error") }
      if let length = response.contentLength, length != count { throw CodePushDownloadFailure("size_mismatch") }
      return response
    }

    func stop(_ error: Error) {
      // Cancellation cannot return while a consumer is still writing: all data
      // callbacks hold this same lock and check stopped before touching the file.
      lock.lock(); defer { lock.unlock() }
      if failure == nil { failure = error }
      stopped = true
    }

    func cancelIfAwaitingResponse(_ task: URLSessionTask) {
      lock.lock()
      let cancel = !stopped && response == nil
      if cancel { failure = CodePushDownloadFailure("network_timeout"); stopped = true }
      lock.unlock()
      if cancel { task.cancel() }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
      stop(CodePushDownloadFailure("redirect_rejected"))
      completionHandler(nil)
      task.cancel()
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask,
                    didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
      lock.lock()
      defer { lock.unlock() }
      guard !stopped, let http = response as? HTTPURLResponse,
            http.statusCode == 200, http.url?.absoluteString == url else {
        if failure == nil { failure = CodePushDownloadFailure("http_error") }
        stopped = true
        completionHandler(.cancel)
        return
      }
      var length: Int64?
      if let header = http.value(forHTTPHeaderField: "Content-Length") {
        guard CodePushManifestValidator.matches(header, "[0-9]+"), let parsed = Int64(header),
              parsed >= 0, parsed <= limit else {
          failure = CodePushDownloadFailure("size_mismatch"); stopped = true
          completionHandler(.cancel); return
        }
        length = parsed
      }
      if let encoding = http.value(forHTTPHeaderField: "Content-Encoding"), encoding.lowercased() != "identity" {
        failure = CodePushDownloadFailure("http_error"); stopped = true
        completionHandler(.cancel); return
      }
      self.response = CodePushHTTPResponse(statusCode: 200, contentLength: length, finalURL: url, redirected: false)
      completionHandler(.allow)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
      lock.lock(); defer { lock.unlock() }
      guard !stopped else { return }
      do {
        guard Int64(data.count) <= limit - count else { throw CodePushDownloadFailure("size_mismatch") }
        if let length = response?.contentLength, Int64(data.count) > length - count {
          throw CodePushDownloadFailure("size_mismatch")
        }
        var offset = 0
        while offset < data.count {
          let part = data.subdata(in: offset..<min(offset + 64 * 1024, data.count))
          try consume(part)
          count += Int64(part.count)
          offset += part.count
        }
      } catch {
        failure = error; stopped = true; dataTask.cancel()
      }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
      lock.lock()
      if failure == nil, let error = error as NSError? {
        failure = CodePushDownloadFailure(error.domain == NSURLErrorDomain && error.code == NSURLErrorTimedOut ? "network_timeout" : "network_error")
      }
      stopped = true
      lock.unlock()
      finished.signal()
    }

    func urlSession(_ session: URLSession, task: URLSessionTask,
                    didReceive challenge: URLAuthenticationChallenge,
                    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
      if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust {
        completionHandler(.performDefaultHandling, nil)
      } else {
        completionHandler(.cancelAuthenticationChallenge, nil)
      }
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask,
                    willCacheResponse proposedResponse: CachedURLResponse,
                    completionHandler: @escaping (CachedURLResponse?) -> Void) {
      completionHandler(nil)
    }
  }
}
