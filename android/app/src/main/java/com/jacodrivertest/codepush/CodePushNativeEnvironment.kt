package com.jacodrivertest.codepush

import android.content.Context
import android.content.res.AssetManager
import android.os.Build
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.util.Base64
import org.json.JSONObject
import org.json.JSONTokener

/** Reads compatibility data and trust anchors only from this APK's generated asset. */
object CodePushNativeEnvironment {
    private const val RESOURCE = "codepush-runtime.json"
    private const val MAX_RESOURCE_BYTES = 512 * 1024
    private val hash = Regex("[a-f0-9]{64}")
    private val token = Regex("[A-Za-z0-9][A-Za-z0-9._+\\-]{0,63}")
    private val buildNumber = Regex("[1-9][0-9]{0,18}")

    data class StorageContract(val driverOfflineCache: Int, val offlineMaps: Int)

    data class NativeRuntimeContext(
        val appId: String,
        val applicationIdentifier: String,
        val platform: String,
        val nativeRuntimeId: String,
        val nativeBuild: String,
        val rnVersion: String,
        val hermesVersion: String,
        val bundleFormat: String,
        val storageContract: StorageContract,
    )

    class RuntimeResult internal constructor(
        val runtime: NativeRuntimeContext? = null,
        val errorCode: String? = null,
    )

    /** Public metadata contains no keyring and is not an installation decision. */
    @JvmStatic
    fun readRuntimeContext(context: Context): RuntimeResult {
        return try {
            RuntimeResult(runtime = load(context).runtime)
        } catch (_: Exception) {
            RuntimeResult(errorCode = "runtime_invalid")
        }
    }

    /** Callers cannot replace the pinned keys with manifest- or JS-supplied keys. */
    @JvmStatic
    fun verifyManifest(
        context: Context,
        envelopeBytes: ByteArray,
    ): CodePushManifestVerifier.VerificationResult {
        val environment = try {
            load(context)
        } catch (_: Exception) {
            return CodePushManifestVerifier.VerificationResult(errorCode = "runtime_invalid")
        }
        return CodePushManifestVerifier.verify(envelopeBytes, environment.trustedKeys)
    }

    private class Environment(
        val runtime: NativeRuntimeContext,
        val trustedKeys: Map<String, String>,
    )

    private fun load(context: Context): Environment {
        val application = context.applicationContext ?: context
        val bytes = application.assets.open(RESOURCE, AssetManager.ACCESS_STREAMING).use { input ->
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(8192)
            while (true) {
                val read = input.read(buffer)
                if (read == -1) break
                require(output.size() + read <= MAX_RESOURCE_BYTES)
                output.write(buffer, 0, read)
            }
            output.toByteArray()
        }
        val text = Charsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(ByteBuffer.wrap(bytes)).toString()
        // This JSON is generated into the APK; remote envelopes use the strict verifier parser.
        val tokenizer = JSONTokener(text)
        val resource = tokenizer.nextValue() as? JSONObject ?: invalidRuntime()
        require(tokenizer.nextClean() == '\u0000')
        requireFields(
            resource,
            setOf("schemaVersion", "runtime", "sourceInputsSha256", "buildFacts", "trustedKeys"),
        )
        require(resource.get("schemaVersion") == 1)
        require(hash.matches(string(resource, "sourceInputsSha256")))
        require(resource.get("buildFacts") is JSONObject)

        val data = resource.get("runtime") as? JSONObject ?: invalidRuntime()
        requireFields(
            data,
            setOf(
                "appId", "applicationIdentifier", "platform", "nativeRuntimeId", "nativeBuild",
                "rnVersion", "hermesVersion", "bundleFormat", "storageContract",
            ),
        )
        val appId = string(data, "appId")
        val applicationIdentifier = string(data, "applicationIdentifier")
        val platform = string(data, "platform")
        val nativeRuntimeId = string(data, "nativeRuntimeId")
        val nativeBuild = string(data, "nativeBuild")
        val rnVersion = string(data, "rnVersion")
        val hermesVersion = string(data, "hermesVersion")
        val bundleFormat = string(data, "bundleFormat")
        require(appId == "jaco-driver" && platform == "android")
        require(applicationIdentifier == application.packageName)
        require(hash.matches(nativeRuntimeId) && buildNumber.matches(nativeBuild))
        require(nativeBuild == installedBuild(application).toString())
        require(token.matches(rnVersion) && token.matches(hermesVersion) && bundleFormat == "js")

        val storage = data.get("storageContract") as? JSONObject ?: invalidRuntime()
        requireFields(storage, setOf("driverOfflineCache", "offlineMaps"))
        require(storage.get("driverOfflineCache") == 1 && storage.get("offlineMaps") == 1)

        val keys = resource.get("trustedKeys") as? JSONObject ?: invalidRuntime()
        require(keys.length() <= 32)
        val trustedKeys = linkedMapOf<String, String>()
        for (keyId in keys.keys()) {
            require(token.matches(keyId))
            val key = string(keys, keyId)
            require(key.isNotEmpty() && key.length <= 124)
            val encoded = Base64.getDecoder().decode(key)
            require(encoded.size == 91)
            require(Base64.getEncoder().encodeToString(encoded) == key)
            trustedKeys[keyId] = key
        }
        return Environment(
            NativeRuntimeContext(
                appId, applicationIdentifier, platform, nativeRuntimeId, nativeBuild,
                rnVersion, hermesVersion, bundleFormat, StorageContract(1, 1),
            ),
            trustedKeys.toMap(),
        )
    }

    @Suppress("DEPRECATION")
    private fun installedBuild(context: Context): Long {
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        val version = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            info.longVersionCode
        } else {
            info.versionCode.toLong()
        }
        require(version > 0)
        return version
    }

    private fun requireFields(data: JSONObject, expected: Set<String>) {
        require(data.keys().asSequence().toSet() == expected)
    }

    private fun string(data: JSONObject, key: String): String =
        data.get(key) as? String ?: invalidRuntime()

    private fun invalidRuntime(): Nothing = throw IllegalArgumentException()
}
