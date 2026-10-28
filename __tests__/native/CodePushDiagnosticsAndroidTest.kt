package com.jacodrivertest.codepush

import java.io.File
import java.nio.channels.FileChannel
import java.nio.file.Files
import java.nio.file.LinkOption.NOFOLLOW_LINKS
import java.nio.file.StandardOpenOption.WRITE
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.Signature
import java.util.Base64

/** Uses real crypto, journals and files. Never executes JS or opens an HTTP connection. */
object CodePushDiagnosticsAndroidTest {
    private val standard = CodePushRuntime("jaco-driver", "com.jacodrivertest", "android", "a".repeat(64), "97", "0.88.0", "260318099.0.4")
    private val pair = KeyPairGenerator.getInstance("EC").apply { initialize(java.security.spec.ECGenParameterSpec("secp256r1")) }.generateKeyPair()
    private val keys = mapOf("download-test-key" to encode(pair.public.encoded))
    private lateinit var base: String
    private lateinit var body: ByteArray
    private var now = 0L
    private var checks = 0
    private data class Ref(val sha: String, val payload: String, val folder: File)

    @JvmStatic fun main(args: Array<String>) {
        val valid = File(args[0]).readLines().map { it.split('\t') }.first { String(decode(it[0])) == "android/valid" }
        val envelope = CodePushJson.parse(decode(valid[2])) as Map<*, *>
        base = String(decode(envelope["payloadBase64"] as String)); body = decode(valid[7]); now = valid[4].toLong()
        val parent = File(args[1]).also { it.mkdirs() }
        readOnlySnapshots(parent)
        observation()
        println("Android diagnostics: $checks assertions passed")
    }

    private fun store(root: File, runtime: CodePushRuntime = standard, token: String = "1".repeat(32), monotonic: () -> Long = System::nanoTime) =
        CodePushVersionStore(root, runtime, { CodePushManifestVerifier.verify(it, keys) }, processToken = token,
            clock = { now }, monotonicNanos = monotonic)

    private fun readOnlySnapshots(parent: File) {
        withRoot(parent) { root, _ ->
            check(store(root).diagnostics().storageStatus == "missing" && !root.exists(), "Reading empty diagnostics created storage")
        }
        withRoot(parent) { root, _ ->
            val old = candidate(root, "global.old = 1;".toByteArray(), 1)
            val previous = candidate(root, "global.previous = 1;".toByteArray(), 2)
            val target = candidate(root, body, 3)
            val state = mapOf("schemaVersion" to 2, "nativeRuntimeId" to standard.nativeRuntimeId,
                "current" to ref(old), "previous" to ref(previous),
                "pending" to mapOf("attemptId" to "4".repeat(32), "processToken" to "5".repeat(32), "candidate" to ref(target), "fallback" to ref(old)),
                "quarantined" to emptyList<String>(), "activationBlocked" to false,
                "lastEvent" to mapOf("code" to "confirmed", "attemptId" to "6".repeat(32), "packageSha256" to old.sha))
            catalog(root).writeText(json(state)); pointer(root, target)
            File(root, "foreign-sentinel").writeText("preserve")
            val before = snapshot(root)
            val result = store(root).diagnostics()
            check(result.storageStatus == "ready" && result.currentPackageId.endsWith(old.sha) && result.previousPackageId.endsWith(previous.sha), "Diagnostics omitted verified confirmed versions")
            check(result.candidateStatus == "ready" && result.candidatePackageId.endsWith(target.sha), "Diagnostics omitted verified candidate")
            check(result.lastEvent == "confirmed" && result.lastEventPackageSha256 == old.sha, "Diagnostics event differs from journal")
            check(snapshot(root) == before && (CodePushJson.parse(catalog(root).readBytes()) as Map<*, *>)["pending"] != null, "Diagnostics recovered or rewrote pending")
            check(!result.toString().contains(root.absolutePath), "Diagnostics leaked path")
            File(target.folder, "index.android.bundle").appendText("corrupt")
            val invalid = store(root).diagnostics()
            check(invalid.candidateStatus == "invalid" && invalid.candidatePackageId.isEmpty() && invalid.currentPackageId.endsWith(old.sha), "Corrupt candidate advertised or hid current")
            File(old.folder, "metadata.json").writeText("invalid")
            val broken = store(root).diagnostics()
            check(broken.storageStatus == "invalid" && broken.currentPackageId.isEmpty() && broken.previousPackageId.endsWith(previous.sha), "Corrupt current advertised as verified")
        }
        withRoot(parent) { root, _ ->
            val target = candidate(root); pointer(root, target)
            val result = store(root).diagnostics()
            check(result.storageStatus == "missing" && result.candidateStatus == "ready" && !catalog(root).exists(), "Candidate-only diagnostics initialized catalogue")
            FileChannel.open(File(root, ".manager.lock").toPath(), WRITE).use { channel -> channel.lock().use {
                val before = snapshot(root)
                check(store(root).diagnostics().storageStatus == "busy", "Diagnostics ignored downloader lock")
                check(before == snapshot(root), "Busy diagnostics modified storage")
            } }
        }
        for (kind in listOf("catalog-symlink", "catalog-hardlink", "pointer-hardlink", "bundle-symlink")) withRoot(parent) { root, container ->
            val target = candidate(root); writeV1(root, target); pointer(root, target)
            val file = when (kind) {
                "catalog-symlink", "catalog-hardlink" -> catalog(root)
                "pointer-hardlink" -> File(runtimeRoot(root), "candidate.json")
                else -> File(target.folder, "index.android.bundle")
            }
            val outside = File(container, "outside").also { it.writeBytes(file.readBytes()) }
            file.delete()
            if (kind.endsWith("symlink")) Files.createSymbolicLink(file.toPath(), outside.toPath()) else Files.createLink(file.toPath(), outside.toPath())
            val before = snapshot(root)
            val result = store(root).diagnostics()
            check(if (kind.startsWith("catalog")) result.storageStatus == "invalid" else result.candidateStatus == "invalid", "Diagnostics followed unsafe file: $kind")
            check(snapshot(root) == before && outside.exists(), "Unsafe diagnostics mutated foreign file: $kind")
        }
        withRoot(parent) { root, _ ->
            val target = candidate(root); writeV1(root, target)
            val before = snapshot(root); var nanos = 0L
            val result = store(root, monotonic = { nanos += 1_000_000_000L; nanos }).diagnostics()
            check(result.errorCode == "diagnostics_timeout" && snapshot(root) == before, "Diagnostics deadline changed journal or leaked startup error")
        }
    }

    private fun observation() {
        val observations = CodePushDownloadActivity()
        check(observations.snapshot().status == "not_checked", "Diagnostic read started download")
        observations.started(); check(observations.snapshot().status == "checking", "Active download not observable")
        val failed = CodePushDownloadResult("error", "hash_mismatch")
        observations.completed(failed); check(observations.snapshot() == failed, "Download error not retained")
        val success = CodePushDownloadResult("downloaded", packageId = "a".repeat(64) + ":" + "b".repeat(64), version = "1.0.2")
        observations.completed(success); check(observations.snapshot() == success, "Download result not retained")
    }

    private fun candidate(root: File, bytes: ByteArray = body, sequence: Int = 1): Ref {
        val text = payload(bytes, sequence, standard); val pack = (CodePushJson.parse(text.toByteArray()) as Map<*, *>)["package"] as Map<*, *>
        val sha = pack["sha256"] as String; val payload = hash(text.toByteArray())
        val directory = File(runtimeRoot(root), "candidates/$sha-$payload").apply { mkdirs() }
        File(root, ".manager.lock").apply { if (!exists()) writeText("") }
        File(directory, "index.android.bundle").writeBytes(bytes); File(directory, "manifest.json").writeBytes(signed(text))
        File(directory, "metadata.json").writeText("{\"manifestSequence\":$sequence,\"nativeRuntimeId\":\"${standard.nativeRuntimeId}\",\"packageSha256\":\"$sha\",\"payloadSha256\":\"$payload\",\"size\":${bytes.size},\"version\":\"1.0.$sequence\"}")
        return Ref(sha, payload, directory)
    }
    private fun payload(bytes: ByteArray, sequence: Int, runtime: CodePushRuntime): String {
        val original = CodePushJson.parse(base.toByteArray()) as Map<*, *>; val pack = original["package"] as Map<*, *>
        return base.replace(standard.applicationIdentifier, runtime.applicationIdentifier)
            .replace(pack["sha256"] as String, hash(bytes)).replace("\"size\":${pack["size"]}", "\"size\":${bytes.size}")
            .replace("\"manifestSequence\":1", "\"manifestSequence\":$sequence").replace("\"version\":\"1.0.1\"", "\"version\":\"1.0.$sequence\"")
    }
    private fun signed(text: String): ByteArray {
        val bytes = text.toByteArray(); val signature = Signature.getInstance("SHA256withECDSA").apply {
            initSign(pair.private); update("jaco-driver-codepush-manifest-v1\n".toByteArray()); update(bytes)
        }.sign()
        return "{\"keyId\":\"download-test-key\",\"payloadBase64\":\"${encode(bytes)}\",\"signatureBase64\":\"${encode(signature)}\"}".toByteArray()
    }
    private fun pointer(root: File, value: Ref) = File(runtimeRoot(root), "candidate.json").writeText(json(ref(value)))
    private fun writeV1(root: File, value: Ref) = catalog(root).writeText(json(mapOf("schemaVersion" to 1, "nativeRuntimeId" to standard.nativeRuntimeId, "current" to ref(value), "previous" to null)))
    private fun ref(value: Ref) = mapOf("packageSha256" to value.sha, "payloadSha256" to value.payload)
    private fun catalog(root: File) = File(runtimeRoot(root), "versions.json")
    private fun runtimeRoot(root: File) = File(root, "v1/${standard.nativeRuntimeId}")
    private fun snapshot(root: File): Map<String, String> = if (!root.exists()) emptyMap() else Files.walk(root.toPath()).use { paths ->
        paths.filter { !Files.isDirectory(it, NOFOLLOW_LINKS) }.map { path -> root.toPath().relativize(path).toString() to
            if (Files.isSymbolicLink(path)) "link:${Files.readSymbolicLink(path)}" else hash(Files.readAllBytes(path)) }.toList().toMap()
    }
    private fun json(value: Any?): String = when (value) {
        null -> "null"
        is String -> "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""
        is Map<*, *> -> value.entries.joinToString(",", "{", "}") { json(it.key) + ":" + json(it.value) }
        is List<*> -> value.joinToString(",", "[", "]") { json(it) }
        else -> value.toString()
    }
    private fun check(value: Boolean, message: String) { checks++; if (!value) throw AssertionError(message) }
    private fun encode(value: ByteArray) = Base64.getEncoder().encodeToString(value)
    private fun decode(value: String) = Base64.getDecoder().decode(value)
    private fun hash(value: ByteArray) = MessageDigest.getInstance("SHA-256").digest(value).joinToString("") { "%02x".format(it.toInt() and 255) }
    private fun withRoot(parent: File, action: (File, File) -> Unit) {
        val container = Files.createTempDirectory(parent.toPath(), "android-diagnostics-").toFile()
        try { action(File(container, "codepush"), container) } finally { Files.walk(container.toPath()).use { paths -> paths.sorted(Comparator.reverseOrder()).forEach { Files.deleteIfExists(it) } } }
    }
}
