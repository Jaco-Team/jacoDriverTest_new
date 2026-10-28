import Foundation
import CoreFoundation

struct CodePushDownloadFailure: Error {
  let code: String
  init(_ code: String) { self.code = code }
}

struct CodePushDownloadManifest {
  let sequence: Int64
  let version: String
  let enabled: Bool
  let rolloutBasisPoints: Int64
  let rolloutSeed: String
  let url: String
  let size: Int64
  let sha256: String
  let entrypoint: String
  let nativeRuntimeId: String
  var packageId: String { nativeRuntimeId + ":" + sha256 }
}

enum CodePushManifestValidator {
  static let maximumSafeInteger: Int64 = 9_007_199_254_740_991
  static let payloadLimit = 512 * 1024
  static let bundleLimit: Int64 = 128 * 1024 * 1024

  static func validate(
    _ bytes: Data, runtime: CodePushNativeRuntimeContext, nowMilliseconds: Int64
  ) throws -> CodePushDownloadManifest {
    try validatePayload(bytes, runtime: runtime, nowMilliseconds: nowMilliseconds)
  }

  /// A locally confirmed version remains usable offline after its original
  /// download admission window closes. Syntax, signature and native compatibility
  /// still apply; publication controls do not revoke an already confirmed file.
  static func validateStoredCompatible(
    _ bytes: Data, runtime: CodePushNativeRuntimeContext
  ) throws -> CodePushDownloadManifest {
    try validatePayload(bytes, runtime: runtime, nowMilliseconds: nil)
  }

  private static func validatePayload(
    _ bytes: Data, runtime: CodePushNativeRuntimeContext, nowMilliseconds: Int64?
  ) throws -> CodePushDownloadManifest {
    let data = try object(CodePushStrictJSON.parse(bytes, limit: payloadLimit), keys: [
      "schemaVersion", "appId", "applicationIdentifier", "platform", "nativeRuntimeId",
      "minNativeBuild", "maxNativeBuild", "rnVersion", "hermesVersion", "bundleFormat",
      "manifestSequence", "releaseId", "version", "issuedAt", "expiresAt", "enabled",
      "rolloutBasisPoints", "rolloutSeed", "package", "storageContract",
    ])
    try require(integer(data["schemaVersion"], min: 1, max: maximumSafeInteger) == 1, "schema_unsupported")
    try require(data["appId"] as? String == "jaco-driver", "app_mismatch")
    let platform = try text(data["platform"], pattern: "(?:android|ios)")
    try require(data["bundleFormat"] as? String == "js", "format_unsupported")
    let identifier = try text(data["applicationIdentifier"], pattern: "[A-Za-z0-9][A-Za-z0-9._-]{0,254}")
    let nativeID = try text(data["nativeRuntimeId"], pattern: "[a-f0-9]{64}")
    let minBuild = try text(data["minNativeBuild"], pattern: "[1-9][0-9]{0,18}")
    let maxBuild = try text(data["maxNativeBuild"], pattern: "[1-9][0-9]{0,18}")
    try require(minBuild == maxBuild, "field_invalid")
    let rnVersion = try token(data["rnVersion"])
    let hermesVersion = try token(data["hermesVersion"])
    let sequence = try integer(data["manifestSequence"], min: 1, max: maximumSafeInteger)
    _ = try token(data["releaseId"])
    let version = try token(data["version"])
    let issued = try timestamp(data["issuedAt"])
    let expires = try timestamp(data["expiresAt"])
    try require(issued < expires, "field_invalid")
    guard let enabledNumber = data["enabled"] as? NSNumber,
          CFGetTypeID(enabledNumber) == CFBooleanGetTypeID() else { throw CodePushDownloadFailure("field_invalid") }
    let enabled = enabledNumber.boolValue
    let rollout = try integer(data["rolloutBasisPoints"], min: 0, max: 10_000)
    let seed = try token(data["rolloutSeed"])
    let storage = try object(data["storageContract"], keys: ["driverOfflineCache", "offlineMaps"])
    try require(integer(storage["driverOfflineCache"], min: 1, max: 1) == 1, "field_invalid")
    try require(integer(storage["offlineMaps"], min: 1, max: 1) == 1, "field_invalid")
    let package = try object(data["package"], keys: ["format", "url", "size", "sha256", "entrypoint"])
    try require(package["format"] as? String == "bundle", "format_unsupported")
    let size = try integer(package["size"], min: 1, max: bundleLimit)
    let hash = try text(package["sha256"], pattern: "[a-f0-9]{64}")
    let entrypoint = platform == "android" ? "index.android.bundle" : "main.jsbundle"
    try require(package["entrypoint"] as? String == entrypoint, "package_invalid")
    let url = try text(package["url"], pattern: "[\\x21-\\x7e]{1,8192}", code: "url_invalid")
    let suffix = platform == "android" ? "bundle" : "jsbundle"
    let expected = "https://storage.yandexcloud.net/jaco-driver-codepush/\(platform)/\(nativeID)/releases/\(hash).\(suffix)"
    try require(url == expected || url.hasPrefix(expected + "?"), "url_source_mismatch")
    let query = String(url.dropFirst(expected.count))
    try require(query.isEmpty || matches(query, "\\?[A-Za-z0-9._~!$&'()*+,;=:@/?%+-]*"), "url_invalid")
    if !query.isEmpty {
      let bytes = Array(query.utf8)
      for index in bytes.indices where bytes[index] == 37 {
        try require(index + 2 < bytes.count && isHex(bytes[index + 1]) && isHex(bytes[index + 2]), "url_invalid")
      }
    }
    try require(runtime.appId == "jaco-driver" && ["android", "ios"].contains(runtime.platform)
      && matches(runtime.nativeRuntimeId, "[a-f0-9]{64}")
      && matches(runtime.nativeBuild, "[1-9][0-9]{0,18}"), "runtime_invalid")
    try require(identifier == runtime.applicationIdentifier && platform == runtime.platform
      && nativeID == runtime.nativeRuntimeId && minBuild == runtime.nativeBuild
      && rnVersion == runtime.rnVersion && hermesVersion == runtime.hermesVersion
      && runtime.bundleFormat == "js", "runtime_mismatch")
    if let now = nowMilliseconds {
      try require(now >= 0 && now <= maximumSafeInteger, "clock_invalid")
      try require(issued <= now, "manifest_not_yet_valid")
      try require(now < expires, "manifest_expired")
    }
    return CodePushDownloadManifest(sequence: sequence, version: version, enabled: enabled,
      rolloutBasisPoints: rollout, rolloutSeed: seed, url: url, size: size,
      sha256: hash, entrypoint: entrypoint, nativeRuntimeId: nativeID)
  }

  static func object(_ value: Any?, keys: [String], code: String = "fields_invalid") throws -> [String: Any] {
    guard let object = value as? [String: Any], object.count == keys.count,
          Set(object.keys) == Set(keys) else { throw CodePushDownloadFailure(code) }
    return object
  }

  static func require(_ condition: @autoclosure () throws -> Bool, _ code: String) throws {
    if try !condition() { throw CodePushDownloadFailure(code) }
  }

  static func integer(_ value: Any?, min: Int64, max: Int64, code: String = "field_invalid") throws -> Int64 {
    guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(),
          number.int64Value >= min, number.int64Value <= max,
          number.doubleValue == Double(number.int64Value) else { throw CodePushDownloadFailure(code) }
    return number.int64Value
  }

  static func text(_ value: Any?, pattern: String, code: String = "field_invalid") throws -> String {
    guard let text = value as? String, matches(text, pattern) else { throw CodePushDownloadFailure(code) }
    return text
  }

  private static func token(_ value: Any?) throws -> String {
    try text(value, pattern: "[A-Za-z0-9][A-Za-z0-9._+-]{0,63}")
  }

  static func matches(_ text: String, _ pattern: String) -> Bool {
    let range = NSRange(text.startIndex..<text.endIndex, in: text)
    guard let expression = try? NSRegularExpression(pattern: "^(?:" + pattern + ")$"),
          let match = expression.firstMatch(in: text, range: range) else { return false }
    return match.range == range
  }

  private static func isHex(_ byte: UInt8) -> Bool {
    (48...57).contains(byte) || (65...70).contains(byte) || (97...102).contains(byte)
  }

  // Gregorian conversion avoids lenient formatter normalization and preserves UTC
  // millisecond boundaries, including the protocol's four-digit year range.
  private static func timestamp(_ value: Any?) throws -> Int64 {
    let string = try text(value, pattern: "[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]{3})?Z")
    let b = Array(string.utf8)
    func number(_ offset: Int, _ length: Int) -> Int64 {
      b[offset..<(offset + length)].reduce(0) { $0 * 10 + Int64($1 - 48) }
    }
    var year = number(0, 4)
    let month = number(5, 2), day = number(8, 2)
    let hour = number(11, 2), minute = number(14, 2), second = number(17, 2)
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)
    let days: [Int64] = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    try require((1...12).contains(month) && day >= 1, "field_invalid")
    try require(day <= days[Int(month - 1)] && hour <= 23 && minute <= 59 && second <= 59, "field_invalid")
    if month <= 2 { year -= 1 }
    let era = (year >= 0 ? year : year - 399) / 400
    let yoe = year - era * 400
    let doy = (153 * (month + (month > 2 ? -3 : 9)) + 2) / 5 + day - 1
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
    let epochDays = era * 146097 + doe - 719468
    return ((epochDays * 24 + hour) * 3600 + minute * 60 + second) * 1000 + (b.count == 24 ? number(20, 3) : 0)
  }
}

/// JSONSerialization supplies values only after the original byte grammar has
/// passed duplicate-key, UTF-8, depth and canonical integer-token checks.
enum CodePushStrictJSON {
  static func parse(_ data: Data, limit: Int) throws -> Any {
    guard data.count <= limit else { throw CodePushDownloadFailure("input_too_large") }
    guard String(data: data, encoding: .utf8) != nil else { throw CodePushDownloadFailure("utf8_invalid") }
    var scanner = Scanner(bytes: Array(data))
    try scanner.scan()
    do { return try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]) }
    catch { throw CodePushDownloadFailure("json_invalid") }
  }

  private struct Scanner {
    let bytes: [UInt8]
    var position = 0
    mutating func scan() throws {
      try value(0)
      whitespace()
      guard position == bytes.count else { throw CodePushDownloadFailure("json_invalid") }
    }
    mutating func value(_ depth: Int) throws {
      guard depth <= 32 else { throw CodePushDownloadFailure("json_too_deep") }
      whitespace()
      guard position < bytes.count else { throw CodePushDownloadFailure("json_invalid") }
      switch bytes[position] {
      case 0x7b, 0x5b:
        let object = bytes[position] == 0x7b
        let end: UInt8 = object ? 0x7d : 0x5d
        position += 1
        whitespace()
        if take(end) { return }
        var keys = Set<String>()
        while true {
          whitespace()
          if object {
            let key = try string()
            guard keys.insert(key).inserted else { throw CodePushDownloadFailure("json_duplicate_key") }
            whitespace()
            try expect(0x3a)
          }
          try value(depth + 1)
          whitespace()
          if take(end) { return }
          try expect(0x2c)
        }
      case 0x22: _ = try string()
      case 0x74: try literal("true")
      case 0x66: try literal("false")
      case 0x6e: try literal("null")
      case 48...57:
        let start = position
        while position < bytes.count && (48...57).contains(bytes[position]) { position += 1 }
        let token = bytes[start..<position]
        guard token.count == 1 || token.first != 48, token.count <= 16,
              let number = Int64(String(bytes: token, encoding: .utf8)!),
              number <= CodePushManifestValidator.maximumSafeInteger else { throw CodePushDownloadFailure("json_invalid") }
      default: throw CodePushDownloadFailure("json_invalid")
      }
    }
    mutating func string() throws -> String {
      try expect(0x22)
      var output: [UInt8] = []
      while position < bytes.count {
        let byte = bytes[position]
        position += 1
        if byte == 0x22 {
          guard let decoded = String(bytes: output, encoding: .utf8) else { throw CodePushDownloadFailure("json_invalid") }
          return decoded
        }
        guard byte >= 0x20 else { throw CodePushDownloadFailure("json_invalid") }
        if byte != 0x5c { output.append(byte); continue }
        guard position < bytes.count else { throw CodePushDownloadFailure("json_invalid") }
        let escape = bytes[position]
        position += 1
        switch escape {
        case 0x22, 0x5c, 0x2f: output.append(escape)
        case 0x62: output.append(8)
        case 0x66: output.append(12)
        case 0x6e: output.append(10)
        case 0x72: output.append(13)
        case 0x74: output.append(9)
        case 0x75:
          let high = try quad()
          var scalar = high
          if (0xd800...0xdbff).contains(high) {
            try expect(0x5c); try expect(0x75)
            let low = try quad()
            guard (0xdc00...0xdfff).contains(low) else { throw CodePushDownloadFailure("json_invalid") }
            scalar = 0x10000 + ((high - 0xd800) << 10) + low - 0xdc00
          } else if (0xdc00...0xdfff).contains(high) { throw CodePushDownloadFailure("json_invalid") }
          guard let unicode = UnicodeScalar(scalar) else { throw CodePushDownloadFailure("json_invalid") }
          output.append(contentsOf: String(unicode).utf8)
        default: throw CodePushDownloadFailure("json_invalid")
        }
      }
      throw CodePushDownloadFailure("json_invalid")
    }
    mutating func quad() throws -> UInt32 {
      var result: UInt32 = 0
      for _ in 0..<4 {
        guard position < bytes.count else { throw CodePushDownloadFailure("json_invalid") }
        let byte = bytes[position]; position += 1
        let digit: UInt32
        switch byte {
        case 48...57: digit = UInt32(byte - 48)
        case 65...70: digit = UInt32(byte - 55)
        case 97...102: digit = UInt32(byte - 87)
        default: throw CodePushDownloadFailure("json_invalid")
        }
        result = result * 16 + digit
      }
      return result
    }
    mutating func literal(_ text: String) throws {
      for byte in text.utf8 { try expect(byte) }
    }
    mutating func whitespace() {
      while position < bytes.count && [0x20, 0x09, 0x0a, 0x0d].contains(bytes[position]) { position += 1 }
    }
    mutating func take(_ byte: UInt8) -> Bool {
      guard position < bytes.count && bytes[position] == byte else { return false }
      position += 1
      return true
    }
    mutating func expect(_ byte: UInt8) throws {
      guard take(byte) else { throw CodePushDownloadFailure("json_invalid") }
    }
  }
}
