import Foundation
import CoreFoundation

struct CodePushNativeRuntimeContext: Equatable {
  let appId: String
  let applicationIdentifier: String
  let platform: String
  let nativeRuntimeId: String
  let nativeBuild: String
  let rnVersion: String
  let hermesVersion: String
  let bundleFormat: String

  var storageContract: [String: Int] {
    ["driverOfflineCache": 1, "offlineMaps": 1]
  }

  var jsonValue: [String: Any] {
    [
      "appId": appId,
      "applicationIdentifier": applicationIdentifier,
      "platform": platform,
      "nativeRuntimeId": nativeRuntimeId,
      "nativeBuild": nativeBuild,
      "rnVersion": rnVersion,
      "hermesVersion": hermesVersion,
      "bundleFormat": bundleFormat,
      "storageContract": storageContract,
    ]
  }
}

/// Uses metadata and trusted public keys packaged with this native application.
/// It never obtains runtime identity or trust roots from a downloaded manifest.
enum CodePushNativeEnvironment {
  private static let resourceLimit = 512 * 1024
  private static let keyLimit = 32

  /// The internal bundle override permits host fixture tests. App callers use .main.
  static func loadRuntimeContext(
    bundle: Bundle = .main
  ) -> Result<CodePushNativeRuntimeContext, CodePushManifestVerificationError> {
    loadEnvironment(bundle: bundle).map { $0.runtime }
  }

  /// Only keys inside the installed native bundle can authenticate the envelope.
  /// The returned bytes still require payload schema and compatibility validation.
  static func verifyManifest(
    _ envelopeBytes: Data,
    bundle: Bundle = .main
  ) -> Result<Data, CodePushManifestVerificationError> {
    switch loadEnvironment(bundle: bundle) {
    case .success(let environment):
      return CodePushManifestVerifier.verify(envelopeBytes, trustedKeys: environment.trustedKeys)
    case .failure(let error):
      return .failure(error)
    }
  }

  private struct Environment {
    let runtime: CodePushNativeRuntimeContext
    let trustedKeys: [String: String]
  }

  private static func loadEnvironment(
    bundle: Bundle
  ) -> Result<Environment, CodePushManifestVerificationError> {
    do {
      guard let resourceURL = bundle.url(forResource: "codepush-runtime", withExtension: "json") else {
        throw CodePushManifestVerificationError.runtimeInvalid
      }
      let file = try FileHandle(forReadingFrom: resourceURL)
      defer { try? file.close() }
      // Reading at most limit + 1 also bounds malformed or unexpectedly large resources.
      var data = Data()
      while data.count <= resourceLimit {
        let chunk = try file.read(upToCount: min(64 * 1024, resourceLimit + 1 - data.count)) ?? Data()
        if chunk.isEmpty { break }
        data.append(chunk)
      }
      guard !data.isEmpty, data.count <= resourceLimit,
            String(data: data, encoding: .utf8) != nil,
            let root = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            exactKeys(root, ["schemaVersion", "runtime", "sourceInputsSha256", "buildFacts", "trustedKeys"]),
            isVersionOne(root["schemaVersion"]),
            let sourceHash = root["sourceInputsSha256"] as? String, validHash(sourceHash),
            root["buildFacts"] is [String: Any],
            let runtime = root["runtime"] as? [String: Any],
            exactKeys(runtime, [
              "appId", "applicationIdentifier", "platform", "nativeRuntimeId", "nativeBuild",
              "rnVersion", "hermesVersion", "bundleFormat", "storageContract",
            ]),
            let appId = runtime["appId"] as? String, appId == "jaco-driver",
            let applicationIdentifier = runtime["applicationIdentifier"] as? String,
            applicationIdentifier == bundle.bundleIdentifier,
            validIdentifier(applicationIdentifier),
            let platform = runtime["platform"] as? String, platform == "ios",
            let nativeRuntimeId = runtime["nativeRuntimeId"] as? String, validHash(nativeRuntimeId),
            let nativeBuild = runtime["nativeBuild"] as? String, validBuild(nativeBuild),
            let binaryBuild = bundle.infoDictionary?["CFBundleVersion"] as? String,
            validBuild(binaryBuild), nativeBuild == binaryBuild,
            let rnVersion = runtime["rnVersion"] as? String, validToken(rnVersion),
            let hermesVersion = runtime["hermesVersion"] as? String, validToken(hermesVersion),
            let bundleFormat = runtime["bundleFormat"] as? String, bundleFormat == "js",
            let storage = runtime["storageContract"] as? [String: Any],
            exactKeys(storage, ["driverOfflineCache", "offlineMaps"]),
            isVersionOne(storage["driverOfflineCache"]), isVersionOne(storage["offlineMaps"]),
            let trustedKeys = root["trustedKeys"] as? [String: String],
            trustedKeys.count <= keyLimit,
            trustedKeys.allSatisfy({ validToken($0.key) && validEncodedKey($0.value) }) else {
        throw CodePushManifestVerificationError.runtimeInvalid
      }
      let context = CodePushNativeRuntimeContext(
        appId: appId, applicationIdentifier: applicationIdentifier, platform: platform,
        nativeRuntimeId: nativeRuntimeId, nativeBuild: nativeBuild, rnVersion: rnVersion,
        hermesVersion: hermesVersion, bundleFormat: bundleFormat
      )
      return .success(Environment(runtime: context, trustedKeys: trustedKeys))
    } catch {
      // Do not expose paths, metadata, parser diagnostics or key material.
      return .failure(.runtimeInvalid)
    }
  }

  private static func exactKeys(_ object: [String: Any], _ keys: [String]) -> Bool {
    object.count == keys.count && Set(object.keys) == Set(keys)
  }

  private static func isVersionOne(_ value: Any?) -> Bool {
    guard let number = value as? NSNumber,
          CFGetTypeID(number) != CFBooleanGetTypeID() else { return false }
    return number == 1
  }

  private static func validHash(_ value: String) -> Bool {
    let bytes = Array(value.utf8)
    return bytes.count == 64 && bytes.allSatisfy { (48...57).contains($0) || (97...102).contains($0) }
  }

  private static func validBuild(_ value: String) -> Bool {
    let bytes = Array(value.utf8)
    guard (1...19).contains(bytes.count), let first = bytes.first, (49...57).contains(first) else {
      return false
    }
    return bytes.allSatisfy { (48...57).contains($0) }
  }

  private static func validToken(_ value: String) -> Bool {
    let bytes = Array(value.utf8)
    guard (1...64).contains(bytes.count), let first = bytes.first, alphanumeric(first) else { return false }
    return bytes.allSatisfy {
      alphanumeric($0) || $0 == 46 || $0 == 95 || $0 == 43 || $0 == 45
    }
  }

  private static func validIdentifier(_ value: String) -> Bool {
    let bytes = Array(value.utf8)
    guard (1...255).contains(bytes.count), let first = bytes.first, alphanumeric(first) else { return false }
    return bytes.allSatisfy { alphanumeric($0) || $0 == 46 || $0 == 95 || $0 == 45 }
  }

  private static func alphanumeric(_ byte: UInt8) -> Bool {
    (48...57).contains(byte) || (65...90).contains(byte) || (97...122).contains(byte)
  }

  private static func validEncodedKey(_ value: String) -> Bool {
    guard value.utf8.count == 124, let data = Data(base64Encoded: value), data.count == 91,
          data.base64EncodedString() == value else { return false }
    let prefix: [UInt8] = [
      0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
      0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00, 0x04,
    ]
    return data.starts(with: prefix)
  }
}
