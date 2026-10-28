package com.jacodrivertest.codepush

import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction

internal class CodePushFailure(val code: String) : Exception()

internal fun cpRequire(condition: Boolean, code: String) {
    if (!condition) throw CodePushFailure(code)
}

/** JSON for protocol v1: exact UTF-8, unique decoded keys and canonical safe integers. */
internal object CodePushJson {
    const val MAX_SAFE_INTEGER = 9007199254740991L

    fun parse(bytes: ByteArray, limit: Int = 512 * 1024): Any? {
        cpRequire(bytes.size <= limit, "input_too_large")
        val text = try {
            Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes)).toString()
        } catch (_: java.nio.charset.CharacterCodingException) {
            throw CodePushFailure("utf8_invalid")
        }
        return Parser(text).parse()
    }

    private class Parser(val text: String) {
        var offset = 0
        fun parse(): Any? {
            whitespace()
            val result = value(0)
            whitespace()
            cpRequire(offset == text.length, "json_invalid")
            return result
        }

        fun value(depth: Int): Any? {
            cpRequire(depth <= 32, "json_too_deep")
            return when (peek()) {
                '{' -> objectValue(depth)
                '[' -> arrayValue(depth)
                '"' -> string()
                't' -> literal("true", true)
                'f' -> literal("false", false)
                'n' -> literal("null", null)
                '-', in '0'..'9' -> number()
                else -> throw CodePushFailure("json_invalid")
            }
        }

        fun objectValue(depth: Int): Map<String, Any?> {
            expect('{')
            whitespace()
            val result = linkedMapOf<String, Any?>()
            if (peek() != '}') while (true) {
                val key = string()
                cpRequire(!result.containsKey(key), "json_duplicate_key")
                whitespace()
                expect(':')
                whitespace()
                result[key] = value(depth + 1)
                whitespace()
                if (peek() != ',') break
                offset++
                whitespace()
            }
            expect('}')
            return result
        }

        fun arrayValue(depth: Int): List<Any?> {
            expect('[')
            whitespace()
            val result = mutableListOf<Any?>()
            if (peek() != ']') while (true) {
                result.add(value(depth + 1))
                whitespace()
                if (peek() != ',') break
                offset++
                whitespace()
            }
            expect(']')
            return result
        }

        fun literal(token: String, value: Any?): Any? {
            cpRequire(text.startsWith(token, offset), "json_invalid")
            offset += token.length
            return value
        }

        fun number(): Long {
            val start = offset
            while (offset < text.length && text[offset] !in " \t\r\n,]}") offset++
            val token = text.substring(start, offset)
            cpRequire(Regex("0|-?[1-9][0-9]*").matches(token), "json_invalid")
            val result = token.toLongOrNull() ?: throw CodePushFailure("json_invalid")
            cpRequire(result in -MAX_SAFE_INTEGER..MAX_SAFE_INTEGER, "json_invalid")
            return result
        }

        fun string(): String {
            expect('"')
            val decoded = StringBuilder()
            while (offset < text.length) {
                val c = text[offset++]
                when {
                    c == '"' -> {
                        val result = decoded.toString()
                        var index = 0
                        while (index < result.length) {
                            val unit = result[index++]
                            if (Character.isHighSurrogate(unit)) {
                                cpRequire(index < result.length && Character.isLowSurrogate(result[index]), "utf8_invalid")
                                index++
                            } else cpRequire(!Character.isLowSurrogate(unit), "utf8_invalid")
                        }
                        return result
                    }
                    c == '\\' -> {
                        cpRequire(offset < text.length, "json_invalid")
                        decoded.append(when (val escaped = text[offset++]) {
                            '"', '\\', '/' -> escaped
                            'b' -> '\b'
                            'f' -> '\u000c'
                            'n' -> '\n'
                            'r' -> '\r'
                            't' -> '\t'
                            'u' -> {
                                cpRequire(offset + 4 <= text.length, "json_invalid")
                                var code = 0
                                repeat(4) {
                                    val digit = when (val h = text[offset++]) {
                                        in '0'..'9' -> h - '0'
                                        in 'a'..'f' -> h - 'a' + 10
                                        in 'A'..'F' -> h - 'A' + 10
                                        else -> throw CodePushFailure("json_invalid")
                                    }
                                    code = code * 16 + digit
                                }
                                code.toChar()
                            }
                            else -> throw CodePushFailure("json_invalid")
                        })
                    }
                    c < ' ' -> throw CodePushFailure("json_invalid")
                    else -> decoded.append(c)
                }
            }
            throw CodePushFailure("json_invalid")
        }

        fun whitespace() { while (offset < text.length && text[offset] in " \t\r\n") offset++ }
        fun peek(): Char? = text.getOrNull(offset)
        fun expect(c: Char) { cpRequire(peek() == c, "json_invalid"); offset++ }
    }
}
