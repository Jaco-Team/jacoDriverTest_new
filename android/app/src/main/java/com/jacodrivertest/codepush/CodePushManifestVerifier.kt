package com.jacodrivertest.codepush

import java.math.BigInteger
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.security.KeyFactory
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECFieldFp
import java.security.spec.X509EncodedKeySpec
import java.util.Base64

/**
 * Verifies only the signed envelope, using keys supplied by the installed binary.
 * Payload schema, runtime compatibility, freshness and replay checks remain required.
 * This class has no Android dependency so the exact implementation can run on the JVM.
 */
object CodePushManifestVerifier {
    private const val MAX_ENVELOPE_BYTES = 704 * 1024
    private const val MAX_PAYLOAD_BYTES = 512 * 1024
    private const val MAX_SIGNATURE_BYTES = 72
    private val signatureContext =
        "jaco-driver-codepush-manifest-v1\n".toByteArray(Charsets.UTF_8)
    private val token = Regex("[A-Za-z0-9][A-Za-z0-9._+\\-]{0,63}")

    private fun hex(value: String) = BigInteger(value, 16)

    private val field = hex("ffffffff00000001000000000000000000000000ffffffffffffffffffffffff")
    private val coefficientA = hex("ffffffff00000001000000000000000000000000fffffffffffffffffffffffc")
    private val coefficientB = hex("5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b")
    private val generatorX = hex("6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296")
    private val generatorY = hex("4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5")
    private val order = hex("ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551")

    // id-ecPublicKey + prime256v1, followed by an uncompressed EC point.
    // Requiring this canonical SPKI also rejects trailing data and explicit parameters.
    private val spkiPrefix = byteArrayOf(
        0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86.toByte(),
        0x48, 0xce.toByte(), 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a,
        0x86.toByte(), 0x48, 0xce.toByte(), 0x3d, 0x03, 0x01, 0x07,
        0x03, 0x42, 0x00, 0x04,
    )

    class VerificationResult internal constructor(
        val payloadBytes: ByteArray? = null,
        val errorCode: String? = null,
    ) {
        val isVerified: Boolean
            get() = payloadBytes != null && errorCode == null
    }

    /** trustedKeys maps a pinned key ID to its canonical base64 SPKI public key. */
    @JvmStatic
    fun verify(
        envelopeBytes: ByteArray,
        trustedKeys: Map<String, String>,
    ): VerificationResult {
        return try {
            requireCheck(envelopeBytes.size <= MAX_ENVELOPE_BYTES, "input_too_large")
            val envelopeText = try {
                Charsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(envelopeBytes)).toString()
            } catch (_: java.nio.charset.CharacterCodingException) {
                fail("utf8_invalid")
            }
            val parsed = EnvelopeParser(envelopeText).parse()
            val envelope = parsed as? Map<*, *> ?: fail("fields_invalid")
            requireCheck(
                envelope.keys == setOf("keyId", "payloadBase64", "signatureBase64"),
                "fields_invalid",
            )
            requireCheck(envelope.values.all { it is String }, "field_invalid")
            val keyId = envelope["keyId"] as String
            requireCheck(token.matches(keyId), "field_invalid")
            val payload = decodeBase64(
                envelope["payloadBase64"] as String, MAX_PAYLOAD_BYTES, "field_invalid",
            )
            val signature = decodeBase64(
                envelope["signatureBase64"] as String, MAX_SIGNATURE_BYTES, "field_invalid",
            )
            requireCheck(isCanonicalEcdsaSignature(signature), "signature_invalid")

            val pinnedKey = trustedKeys[keyId] ?: fail("key_unknown")
            val publicKey = readPublicKey(pinnedKey)
            val verifier = Signature.getInstance("SHA256withECDSA")
            verifier.initVerify(publicKey)
            verifier.update(signatureContext)
            verifier.update(payload)
            requireCheck(verifier.verify(signature), "signature_invalid")
            VerificationResult(payloadBytes = payload)
        } catch (failure: VerificationFailure) {
            VerificationResult(errorCode = failure.code)
        } catch (_: Exception) {
            // Providers may throw on malformed signatures. Never expose their messages.
            VerificationResult(errorCode = "signature_invalid")
        }
    }

    private fun decodeBase64(text: String, maxBytes: Int, error: String): ByteArray {
        val maxCharacters = ((maxBytes + 2) / 3) * 4
        requireCheck(text.isNotEmpty() && text.length <= maxCharacters, error)
        val decoded = try {
            Base64.getDecoder().decode(text)
        } catch (_: IllegalArgumentException) {
            fail(error)
        }
        requireCheck(decoded.isNotEmpty() && decoded.size <= maxBytes, error)
        requireCheck(Base64.getEncoder().encodeToString(decoded) == text, error)
        return decoded
    }

    private fun readPublicKey(base64: String): ECPublicKey {
        return try {
            val encoded = decodeBase64(base64, 91, "key_invalid")
            requireCheck(
                encoded.size == 91 &&
                    spkiPrefix.indices.all { encoded[it] == spkiPrefix[it] },
                "key_invalid",
            )
            val key = KeyFactory.getInstance("EC")
                .generatePublic(X509EncodedKeySpec(encoded)) as? ECPublicKey
                ?: fail("key_invalid")
            val parameters = key.params
            val primeField = parameters.curve.field as? ECFieldFp ?: fail("key_invalid")
            requireCheck(
                primeField.p == field &&
                    parameters.curve.a == coefficientA &&
                    parameters.curve.b == coefficientB &&
                    parameters.generator.affineX == generatorX &&
                    parameters.generator.affineY == generatorY &&
                    parameters.order == order && parameters.cofactor == 1,
                "key_invalid",
            )
            val x = key.w.affineX ?: fail("key_invalid")
            val y = key.w.affineY ?: fail("key_invalid")
            requireCheck(
                x.signum() >= 0 && x < field && y.signum() >= 0 && y < field &&
                    y.multiply(y).mod(field) ==
                    x.multiply(x).multiply(x).add(coefficientA.multiply(x))
                        .add(coefficientB).mod(field),
                "key_invalid",
            )
            key
        } catch (failure: VerificationFailure) {
            throw failure
        } catch (_: Exception) {
            fail("key_invalid")
        }
    }

    private fun isCanonicalEcdsaSignature(bytes: ByteArray): Boolean {
        if (bytes.size !in 8..MAX_SIGNATURE_BYTES || bytes[0] != 0x30.toByte()) return false
        if (bytes[1].toInt() != bytes.size - 2) return false
        var offset = 2
        repeat(2) {
            if (offset + 2 > bytes.size || bytes[offset++] != 0x02.toByte()) return false
            val length = bytes[offset++].toInt() and 0xff
            if (length !in 1..33 || offset + length > bytes.size) return false
            val first = bytes[offset].toInt() and 0xff
            if (first >= 0x80) return false
            if (length > 1 && first == 0 && (bytes[offset + 1].toInt() and 0x80) == 0) {
                return false
            }
            val integer = BigInteger(1, bytes.copyOfRange(offset, offset + length))
            if (integer.signum() <= 0 || integer >= order) return false
            offset += length
        }
        return offset == bytes.size
    }

    /** Strict JSON avoids provider-specific duplicate-key and Unicode handling. */
    private class EnvelopeParser(private val input: String) {
        private var offset = 0
        private object NonStringValue

        fun parse(): Any {
            whitespace()
            val result = value(0)
            whitespace()
            requireCheck(offset == input.length, "json_invalid")
            return result
        }

        private fun value(depth: Int): Any {
            requireCheck(depth <= 32, "json_invalid")
            return when (peek()) {
                '{' -> objectValue(depth)
                '[' -> arrayValue(depth)
                '"' -> string()
                't' -> literal("true")
                'f' -> literal("false")
                'n' -> literal("null")
                '-', in '0'..'9' -> number()
                else -> fail("json_invalid")
            }
        }

        private fun objectValue(depth: Int): Map<String, Any> {
            val result = linkedMapOf<String, Any>()
            expect('{')
            whitespace()
            if (peek() != '}') {
                while (true) {
                    val key = string()
                    requireCheck(!result.containsKey(key), "json_duplicate_key")
                    whitespace()
                    expect(':')
                    whitespace()
                    result[key] = value(depth + 1)
                    whitespace()
                    if (peek() != ',') break
                    offset++
                    whitespace()
                }
            }
            expect('}')
            return result
        }

        private fun arrayValue(depth: Int): Any {
            expect('[')
            whitespace()
            if (peek() != ']') {
                while (true) {
                    value(depth + 1)
                    whitespace()
                    if (peek() != ',') break
                    offset++
                    whitespace()
                }
            }
            expect(']')
            return NonStringValue
        }

        private fun literal(text: String): Any {
            requireCheck(input.startsWith(text, offset), "json_invalid")
            offset += text.length
            return NonStringValue
        }

        private fun number(): Any {
            if (peek() == '-') offset++
            if (peek() == '0') {
                offset++
            } else {
                requireCheck(peek() in '1'..'9', "json_invalid")
                do {
                    offset++
                } while (peek() in '0'..'9')
            }
            if (peek() == '.') {
                offset++
                requireCheck(peek() in '0'..'9', "json_invalid")
                do {
                    offset++
                } while (peek() in '0'..'9')
            }
            if (peek() == 'e' || peek() == 'E') {
                offset++
                if (peek() == '+' || peek() == '-') offset++
                requireCheck(peek() in '0'..'9', "json_invalid")
                do {
                    offset++
                } while (peek() in '0'..'9')
            }
            return NonStringValue
        }

        private fun string(): String {
            expect('"')
            val decoded = StringBuilder()
            while (offset < input.length) {
                val character = input[offset++]
                when {
                    character == '"' -> {
                        val value = decoded.toString()
                        var index = 0
                        while (index < value.length) {
                            val unit = value[index++]
                            if (Character.isHighSurrogate(unit)) {
                                requireCheck(
                                    index < value.length && Character.isLowSurrogate(value[index]),
                                    "json_invalid",
                                )
                                index++
                            } else {
                                requireCheck(!Character.isLowSurrogate(unit), "json_invalid")
                            }
                        }
                        return value
                    }
                    character == '\\' -> {
                        requireCheck(offset < input.length, "json_invalid")
                        decoded.append(
                            when (val escaped = input[offset++]) {
                                '"', '\\', '/' -> escaped
                                'b' -> '\b'
                                'f' -> '\u000c'
                                'n' -> '\n'
                                'r' -> '\r'
                                't' -> '\t'
                                'u' -> {
                                    requireCheck(offset + 4 <= input.length, "json_invalid")
                                    var value = 0
                                    repeat(4) {
                                        val digit = when (val hexDigit = input[offset++]) {
                                            in '0'..'9' -> hexDigit - '0'
                                            in 'a'..'f' -> hexDigit - 'a' + 10
                                            in 'A'..'F' -> hexDigit - 'A' + 10
                                            else -> fail("json_invalid")
                                        }
                                        value = value * 16 + digit
                                    }
                                    value.toChar()
                                }
                                else -> fail("json_invalid")
                            },
                        )
                    }
                    character < ' ' -> fail("json_invalid")
                    else -> decoded.append(character)
                }
            }
            fail("json_invalid")
        }

        private fun whitespace() {
            while (offset < input.length && input[offset] in " \t\n\r") offset++
        }

        private fun peek(): Char? = input.getOrNull(offset)

        private fun expect(character: Char) {
            requireCheck(peek() == character, "json_invalid")
            offset++
        }
    }

    private class VerificationFailure(val code: String) : IllegalArgumentException()

    private fun requireCheck(condition: Boolean, code: String) {
        if (!condition) fail(code)
    }

    private fun fail(code: String): Nothing = throw VerificationFailure(code)
}
