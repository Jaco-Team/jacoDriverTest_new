package com.jacodrivertest.codepush

import java.time.Instant
import java.time.format.DateTimeFormatterBuilder

data class CodePushRuntime(
    val appId: String,
    val applicationIdentifier: String,
    val platform: String,
    val nativeRuntimeId: String,
    val nativeBuild: String,
    val rnVersion: String,
    val hermesVersion: String,
    val bundleFormat: String = "js",
    val driverOfflineCache: Int = 1,
    val offlineMaps: Int = 1,
)

data class CodePushManifest(
    val runtime: CodePushRuntime,
    val sequence: Long,
    val version: String,
    val enabled: Boolean,
    val rolloutBasisPoints: Int,
    val rolloutSeed: String,
    val issuedAtMillis: Long,
    val expiresAtMillis: Long,
    val url: String,
    val size: Long,
    val sha256: String,
    val entrypoint: String,
) {
    val packageId: String get() = "${runtime.nativeRuntimeId}:$sha256"
}

object CodePushManifestValidator {
    internal val hashPattern = Regex("[a-f0-9]{64}")
    private val token = Regex("[A-Za-z0-9][A-Za-z0-9._+\\-]{0,63}")
    private val identifier = Regex("[A-Za-z0-9][A-Za-z0-9._\\-]{0,254}")
    private val build = Regex("[1-9][0-9]{0,18}")
    private val fields = setOf("schemaVersion", "appId", "applicationIdentifier", "platform", "nativeRuntimeId",
        "minNativeBuild", "maxNativeBuild", "rnVersion", "hermesVersion", "bundleFormat", "manifestSequence",
        "releaseId", "version", "issuedAt", "expiresAt", "enabled", "rolloutBasisPoints", "rolloutSeed", "package", "storageContract")

    fun validate(bytes: ByteArray, expected: CodePushRuntime, nowMillis: Long): CodePushManifest {
        val manifest = validateStoredCompatible(bytes, expected)
        cpRequire(nowMillis in 0..CodePushJson.MAX_SAFE_INTEGER, "clock_invalid")
        cpRequire(manifest.issuedAtMillis <= nowMillis, "manifest_not_yet_valid")
        cpRequire(nowMillis < manifest.expiresAtMillis, "manifest_expired")
        return manifest
    }

    /** Confirmed local versions keep schema/signature/compatibility checks, without new-admission dates. */
    fun validateStoredCompatible(bytes: ByteArray, expected: CodePushRuntime): CodePushManifest {
        val data = record(CodePushJson.parse(bytes), fields)
        cpRequire(data["schemaVersion"] == 1L, "schema_unsupported")
        cpRequire(data["appId"] == "jaco-driver", "app_mismatch")
        val platform = text(data["platform"], Regex("android|ios"))
        cpRequire(data["bundleFormat"] == "js", "format_unsupported")
        val minBuild = text(data["minNativeBuild"], build)
        cpRequire(minBuild == text(data["maxNativeBuild"], build), "field_invalid")
        val runtime = CodePushRuntime("jaco-driver", text(data["applicationIdentifier"], identifier), platform,
            text(data["nativeRuntimeId"], hashPattern), minBuild, text(data["rnVersion"], token), text(data["hermesVersion"], token))
        val storage = record(data["storageContract"], setOf("driverOfflineCache", "offlineMaps"))
        cpRequire(storage["driverOfflineCache"] == 1L && storage["offlineMaps"] == 1L, "field_invalid")
        text(data["releaseId"], token)
        val version = text(data["version"], token)
        val issued = timestamp(data["issuedAt"])
        val expires = timestamp(data["expiresAt"])
        cpRequire(issued < expires, "field_invalid")
        val enabled = data["enabled"] as? Boolean ?: throw CodePushFailure("field_invalid")
        val sequence = integer(data["manifestSequence"], 1, CodePushJson.MAX_SAFE_INTEGER)
        val rollout = integer(data["rolloutBasisPoints"], 0, 10000).toInt()
        val seed = text(data["rolloutSeed"], token)
        val bundle = record(data["package"], setOf("format", "url", "size", "sha256", "entrypoint"))
        cpRequire(bundle["format"] == "bundle", "format_unsupported")
        val sha = text(bundle["sha256"], hashPattern)
        val size = integer(bundle["size"], 1, 128L * 1024 * 1024)
        val entrypoint = if (platform == "android") "index.android.bundle" else "main.jsbundle"
        cpRequire(bundle["entrypoint"] == entrypoint, "package_invalid")
        val url = bundle["url"] as? String ?: throw CodePushFailure("url_invalid")
        cpRequire(url.length <= 8192 && Regex("[\\x21-\\x7e]+").matches(url), "url_invalid")
        val extension = if (platform == "android") "bundle" else "jsbundle"
        val base = "https://storage.yandexcloud.net/jaco-driver-codepush/$platform/${runtime.nativeRuntimeId}/releases/$sha.$extension"
        cpRequire(url == base || url.startsWith("$base?"), "url_source_mismatch")
        val query = url.substring(base.length)
        cpRequire(query.isEmpty() || (Regex("\\?[A-Za-z0-9._~!$&'()*+,;=:@/?%+\\-]*").matches(query) &&
            !Regex("%(?![0-9a-fA-F]{2})").containsMatchIn(query)), "url_invalid")
        cpRequire(expected.appId == "jaco-driver" && expected.platform == "android" &&
            hashPattern.matches(expected.nativeRuntimeId) && build.matches(expected.nativeBuild) &&
            expected.bundleFormat == "js" && expected.driverOfflineCache == 1 && expected.offlineMaps == 1, "runtime_invalid")
        cpRequire(runtime == expected, "runtime_mismatch")
        return CodePushManifest(runtime, sequence, version, enabled, rollout, seed, issued, expires, url, size, sha, entrypoint)
    }

    internal fun record(value: Any?, fields: Set<String>): Map<*, *> {
        val record = value as? Map<*, *> ?: throw CodePushFailure("fields_invalid")
        cpRequire(record.keys == fields, "fields_invalid")
        return record
    }
    internal fun integer(value: Any?, min: Long, max: Long): Long {
        val number = value as? Long ?: throw CodePushFailure("field_invalid")
        cpRequire(number in min..max, "field_invalid")
        return number
    }
    internal fun text(value: Any?, pattern: Regex): String {
        val result = value as? String ?: throw CodePushFailure("field_invalid")
        cpRequire(pattern.matches(result), "field_invalid")
        return result
    }
    private fun timestamp(value: Any?): Long {
        val source = text(value, Regex("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]{3})?Z"))
        try {
            val instant = Instant.parse(source)
            val canonical = if (source.contains('.')) source else source.replace("Z", ".000Z")
            cpRequire(DateTimeFormatterBuilder().appendInstant(3).toFormatter().format(instant) == canonical, "field_invalid")
            return instant.toEpochMilli()
        } catch (failure: CodePushFailure) { throw failure }
        catch (_: Exception) { throw CodePushFailure("field_invalid") }
    }
}
