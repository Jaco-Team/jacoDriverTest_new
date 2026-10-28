import Foundation
import Security

enum CodePushManifestVerificationError: String, Error, Equatable {
  case inputTooLarge = "input_too_large"
  case utf8Invalid = "utf8_invalid"
  case jsonInvalid = "json_invalid"
  case jsonDuplicateKey = "json_duplicate_key"
  case fieldsInvalid = "fields_invalid"
  case fieldInvalid = "field_invalid"
  case keyUnknown = "key_unknown"
  case keyInvalid = "key_invalid"
  case signatureInvalid = "signature_invalid"
  case runtimeInvalid = "runtime_invalid"
}

/// Authenticates the original payload bytes. Schema, compatibility, freshness and
/// installation checks remain separate and must run before using an update.
enum CodePushManifestVerifier {
  private static let envelopeLimit = 704 * 1024
  private static let payloadLimit = 512 * 1024
  private static let signatureContext = Data("jaco-driver-codepush-manifest-v1\n".utf8)

  /// `trustedKeys` comes only from keys embedded in the native binary. Values are
  /// canonical base64 DER SubjectPublicKeyInfo for uncompressed P-256 public keys.
  static func verify(
    _ envelopeBytes: Data,
    trustedKeys: [String: String]
  ) -> Result<Data, CodePushManifestVerificationError> {
    do {
      guard envelopeBytes.count <= envelopeLimit else {
        throw CodePushManifestVerificationError.inputTooLarge
      }
      guard String(data: envelopeBytes, encoding: .utf8) != nil else {
        throw CodePushManifestVerificationError.utf8Invalid
      }
      var parser = EnvelopeParser(bytes: Array(envelopeBytes))
      let envelope = try parser.parse()
      guard let keyId = envelope["keyId"], validKeyId(keyId),
            let encodedPayload = envelope["payloadBase64"],
            let encodedSignature = envelope["signatureBase64"] else {
        throw CodePushManifestVerificationError.fieldInvalid
      }
      guard let payload = decodeBase64(encodedPayload, limit: payloadLimit),
            let signature = decodeBase64(encodedSignature, limit: 72) else {
        throw CodePushManifestVerificationError.fieldInvalid
      }
      guard validSignatureDER(signature) else {
        throw CodePushManifestVerificationError.signatureInvalid
      }
      guard let encodedKey = trustedKeys[keyId] else {
        throw CodePushManifestVerificationError.keyUnknown
      }
      guard let publicKey = publicKey(encodedKey) else {
        throw CodePushManifestVerificationError.keyInvalid
      }
      let algorithm = SecKeyAlgorithm.ecdsaSignatureMessageX962SHA256
      guard SecKeyIsAlgorithmSupported(publicKey, .verify, algorithm) else {
        throw CodePushManifestVerificationError.keyInvalid
      }
      var signedBytes = signatureContext
      signedBytes.append(payload)
      var cryptoError: Unmanaged<CFError>?
      guard SecKeyVerifySignature(
        publicKey, algorithm, signedBytes as CFData, signature as CFData, &cryptoError
      ) else {
        // Never expose Security errors, remote input or key material in diagnostics.
        _ = cryptoError?.takeRetainedValue()
        throw CodePushManifestVerificationError.signatureInvalid
      }
      _ = cryptoError?.takeRetainedValue()
      return .success(payload)
    } catch let error as CodePushManifestVerificationError {
      return .failure(error)
    } catch {
      return .failure(.fieldInvalid)
    }
  }

  private static func validKeyId(_ value: String) -> Bool {
    let bytes = Array(value.utf8)
    guard (1...64).contains(bytes.count), let first = bytes.first,
          asciiAlphanumeric(first) else { return false }
    return bytes.allSatisfy {
      asciiAlphanumeric($0) || $0 == 46 || $0 == 95 || $0 == 43 || $0 == 45
    }
  }

  private static func asciiAlphanumeric(_ byte: UInt8) -> Bool {
    (48...57).contains(byte) || (65...90).contains(byte) || (97...122).contains(byte)
  }

  private static func decodeBase64(_ value: String, limit: Int) -> Data? {
    guard !value.isEmpty, value.utf8.count <= ((limit + 2) / 3) * 4,
          let decoded = Data(base64Encoded: value), !decoded.isEmpty,
          decoded.count <= limit, decoded.base64EncodedString() == value else { return nil }
    return decoded
  }

  private static func publicKey(_ encoded: String) -> SecKey? {
    // Exact DER AlgorithmIdentifier: id-ecPublicKey + prime256v1. A fixed header
    // rejects other curves, compressed points, indefinite lengths and trailing data.
    let prefix: [UInt8] = [
      0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
      0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
    ]
    guard let spki = decodeBase64(encoded, limit: 91), spki.count == 91 else { return nil }
    let bytes = Array(spki)
    guard bytes.starts(with: prefix), bytes[26] == 0x04 else { return nil }
    let attributes: [CFString: Any] = [
      kSecAttrKeyType: kSecAttrKeyTypeECSECPrimeRandom,
      kSecAttrKeyClass: kSecAttrKeyClassPublic,
      kSecAttrKeySizeInBits: 256,
    ]
    var keyError: Unmanaged<CFError>?
    let key = SecKeyCreateWithData(
      Data(bytes.dropFirst(prefix.count)) as CFData, attributes as CFDictionary, &keyError
    )
    _ = keyError?.takeRetainedValue()
    return key
  }

  private static func validSignatureDER(_ data: Data) -> Bool {
    let bytes = Array(data)
    guard (8...72).contains(bytes.count), bytes[0] == 0x30,
          Int(bytes[1]) == bytes.count - 2 else { return false }
    // Order of the NIST P-256 base point. Both components must be 0 < x < n.
    let order: [UInt8] = [
      0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00,
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
      0xbc, 0xe6, 0xfa, 0xad, 0xa7, 0x17, 0x9e, 0x84,
      0xf3, 0xb9, 0xca, 0xc2, 0xfc, 0x63, 0x25, 0x51,
    ]
    var position = 2
    for _ in 0..<2 {
      guard position + 2 <= bytes.count, bytes[position] == 0x02 else { return false }
      let length = Int(bytes[position + 1])
      position += 2
      guard (1...33).contains(length), position + length <= bytes.count else { return false }
      var integer = Array(bytes[position..<(position + length)])
      position += length
      guard integer[0] & 0x80 == 0 else { return false }
      if integer[0] == 0 {
        guard integer.count > 1, integer[1] & 0x80 != 0 else { return false }
        integer.removeFirst()
      }
      guard integer.count <= 32, integer.contains(where: { $0 != 0 }) else { return false }
      if integer.count == 32 && !integer.lexicographicallyPrecedes(order) { return false }
    }
    return position == bytes.count
  }
}

/// The envelope permits exactly three string fields, so it has no recursive JSON
/// values. Decoding keys before insertion also detects escaped duplicate keys.
private struct EnvelopeParser {
  let bytes: [UInt8]
  private var position = 0

  init(bytes: [UInt8]) {
    self.bytes = bytes
  }

  mutating func parse() throws -> [String: String] {
    skipWhitespace()
    try expect(0x7b)
    skipWhitespace()
    var fields: [String: String] = [:]
    if take(0x7d) {
      throw CodePushManifestVerificationError.fieldsInvalid
    }
    while true {
      let key = try string()
      guard fields[key] == nil else { throw CodePushManifestVerificationError.jsonDuplicateKey }
      skipWhitespace()
      try expect(0x3a)
      skipWhitespace()
      let value = try string()
      fields[key] = value
      guard fields.count <= 3 else { throw CodePushManifestVerificationError.fieldsInvalid }
      skipWhitespace()
      if take(0x7d) { break }
      try expect(0x2c)
      skipWhitespace()
    }
    skipWhitespace()
    guard position == bytes.count else { throw CodePushManifestVerificationError.jsonInvalid }
    guard fields.count == 3, Set(fields.keys) == Set(["keyId", "payloadBase64", "signatureBase64"]) else {
      throw CodePushManifestVerificationError.fieldsInvalid
    }
    return fields
  }

  private mutating func string() throws -> String {
    try expect(0x22)
    var decoded: [UInt8] = []
    while position < bytes.count {
      let byte = bytes[position]
      position += 1
      if byte == 0x22 {
        guard let value = String(bytes: decoded, encoding: .utf8) else {
          throw CodePushManifestVerificationError.jsonInvalid
        }
        return value
      }
      guard byte >= 0x20 else { throw CodePushManifestVerificationError.jsonInvalid }
      if byte != 0x5c {
        decoded.append(byte)
        continue
      }
      guard position < bytes.count else { throw CodePushManifestVerificationError.jsonInvalid }
      let escape = bytes[position]
      position += 1
      switch escape {
      case 0x22, 0x5c, 0x2f: decoded.append(escape)
      case 0x62: decoded.append(0x08)
      case 0x66: decoded.append(0x0c)
      case 0x6e: decoded.append(0x0a)
      case 0x72: decoded.append(0x0d)
      case 0x74: decoded.append(0x09)
      case 0x75:
        let high = try hexQuad()
        var scalar = high
        if (0xd800...0xdbff).contains(high) {
          try expect(0x5c)
          try expect(0x75)
          let low = try hexQuad()
          guard (0xdc00...0xdfff).contains(low) else {
            throw CodePushManifestVerificationError.jsonInvalid
          }
          scalar = 0x10000 + ((high - 0xd800) << 10) + low - 0xdc00
        } else if (0xdc00...0xdfff).contains(high) {
          throw CodePushManifestVerificationError.jsonInvalid
        }
        guard let unicode = UnicodeScalar(scalar) else {
          throw CodePushManifestVerificationError.jsonInvalid
        }
        decoded.append(contentsOf: String(unicode).utf8)
      default: throw CodePushManifestVerificationError.jsonInvalid
      }
    }
    throw CodePushManifestVerificationError.jsonInvalid
  }

  private mutating func hexQuad() throws -> UInt32 {
    guard position + 4 <= bytes.count else { throw CodePushManifestVerificationError.jsonInvalid }
    var result: UInt32 = 0
    for _ in 0..<4 {
      let byte = bytes[position]
      position += 1
      let nibble: UInt32
      switch byte {
      case 48...57: nibble = UInt32(byte - 48)
      case 65...70: nibble = UInt32(byte - 55)
      case 97...102: nibble = UInt32(byte - 87)
      default: throw CodePushManifestVerificationError.jsonInvalid
      }
      result = (result << 4) | nibble
    }
    return result
  }

  private mutating func skipWhitespace() {
    while position < bytes.count {
      switch bytes[position] {
      case 0x20, 0x09, 0x0a, 0x0d: position += 1
      default: return
      }
    }
  }

  private mutating func take(_ byte: UInt8) -> Bool {
    guard position < bytes.count, bytes[position] == byte else { return false }
    position += 1
    return true
  }

  private mutating func expect(_ byte: UInt8) throws {
    guard take(byte) else { throw CodePushManifestVerificationError.jsonInvalid }
  }
}
