package com.jacodrivertest.codepush

import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.nio.file.Files
import java.security.KeyPairGenerator
import java.security.Signature
import java.util.Base64
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/** Host harness compiles the production Kotlin core, without Android mocks or live S3. */
object CodePushDownloadAndroidTest {
    private val runtime = CodePushRuntime("jaco-driver", "com.jacodrivertest", "android", "a".repeat(64), "97", "0.88.0", "260318099.0.4")
    private var checks = 0
    private lateinit var basePayload: String
    private lateinit var bundle: ByteArray
    private var now = 0L
    private val pair = KeyPairGenerator.getInstance("EC").apply { initialize(java.security.spec.ECGenParameterSpec("secp256r1")) }.generateKeyPair()
    private val ownKeys = mapOf("download-test-key" to Base64.getEncoder().encodeToString(pair.public.encoded))

    @JvmStatic fun main(args: Array<String>) {
        val parent = File(args[1]).also { it.mkdirs() }
        val vectors = File(args[0]).readLines().map { it.split('\t') }.filter { it[1] == "android" }
        for (v in vectors) {
            val name = String(decode(v[0]), Charsets.UTF_8)
            withRoot(parent) { root ->
                seedId(root, v[8])
                val result = manager(root, decode(v[2]), decode(v[7]), v[4].toLong(), mapOf("download-test-key" to v[3])).checkAndDownload()
                check(result.status == v[5], "$name expected ${v[5]} got ${result.status}/${result.errorCode}")
                if (v[5] == "error") check(v[6].split(',').contains(result.errorCode), "$name wrong error ${result.errorCode}")
                if (name == "android/valid") {
                    bundle = decode(v[7]); now = v[4].toLong()
                    val envelope = CodePushJson.parse(decode(v[2])) as Map<*, *>
                    basePayload = String(decode(envelope["payloadBase64"] as String), Charsets.UTF_8)
                }
            }
        }
        check(::basePayload.isInitialized, "Missing valid fixture")
        filesystemChecks(parent)
        failureChecks(parent)
        replayChecks(parent)
        faultChecks(parent)
        concurrencyChecks(parent)
        abandonedChecks(parent)
        rolloutChecks(parent)
        productionTransportChecks()
        println("Android downloader: ${vectors.size} shared vectors; $checks assertions passed")
    }

    private fun manager(
        root: File,
        envelope: ByteArray = signed(),
        body: ByteArray = bundle,
        clock: Long = now,
        keys: Map<String, String> = ownKeys,
        transport: CodePushTransport? = null,
        disk: (File) -> Long = { Long.MAX_VALUE },
        fault: (String) -> Unit = {},
        monotonic: () -> Long = System::nanoTime,
    ): CodePushDownloadManager = CodePushDownloadManager(root, runtime,
        { CodePushManifestVerifier.verify(it, keys) }, transport ?: CodePushTransport { url, _ ->
            val bytes = if (url.endsWith("manifest.json")) envelope else body
            CodePushResponse(200, bytes.size.toLong(), ByteArrayInputStream(bytes))
        }, { clock }, disk, fault, monotonic)

    private fun signed(payload: String = basePayload): ByteArray {
        val bytes = payload.toByteArray(Charsets.UTF_8)
        val signature = Signature.getInstance("SHA256withECDSA").apply {
            initSign(pair.private)
            update("jaco-driver-codepush-manifest-v1\n".toByteArray())
            update(bytes)
        }.sign()
        return "{\"keyId\":\"download-test-key\",\"payloadBase64\":\"${encode(bytes)}\",\"signatureBase64\":\"${encode(signature)}\"}".toByteArray()
    }

    private fun filesystemChecks(parent: File) {
        withRoot(parent) { root ->
            seedId(root)
            val foreign = File(root, "foreign.txt").apply { writeText("preserve") }
            val envelope = signed()
            var bundleRequests = 0
            val transport = CodePushTransport { url, _ ->
                val bytes = if (url.endsWith("manifest.json")) envelope else bundle.also { bundleRequests++ }
                CodePushResponse(200, bytes.size.toLong(), ByteArrayInputStream(bytes))
            }
            val m = manager(root, transport = transport)
            check(m.checkAndDownload().status == "downloaded", "Initial candidate")
            check(m.checkAndDownload().status == "already_downloaded", "Verified existing candidate")
            check(bundleRequests == 1, "Existing candidate was needlessly downloaded")
            check(foreign.readText() == "preserve", "Foreign file changed")
            val directory = candidate(root)
            check(directory.list()?.toSet() == setOf("index.android.bundle", "manifest.json", "metadata.json"), "Candidate contents")
            check(!File(root, "active.json").exists(), "Unexpected active switch")
            val binary = File(directory, "index.android.bundle")
            binary.writeBytes(bundle.copyOf().also { it[0] = (it[0].toInt() xor 1).toByte() })
            check(m.checkAndDownload().errorCode == "hash_mismatch", "Tampered existing bundle accepted")
            check(foreign.readText() == "preserve", "Foreign file removed after corrupt candidate")
        }
        for (target in listOf("root", "runtime", "lock", "bundle")) withRoot(parent) { root ->
            val outside = File(root.parentFile, "outside-${System.nanoTime()}").apply { writeText("outside") }
            try {
                seedId(root)
                when (target) {
                    "root" -> {
                        root.deleteRecursively()
                        Files.createSymbolicLink(root.toPath(), outside.toPath())
                    }
                    "runtime" -> {
                        File(root, "v1").mkdir()
                        Files.createSymbolicLink(File(root, "v1/${runtime.nativeRuntimeId}").toPath(), outside.toPath())
                    }
                    "lock" -> Files.createSymbolicLink(File(root, ".manager.lock").toPath(), outside.toPath())
                    "bundle" -> {
                        check(manager(root).checkAndDownload().status == "downloaded", "Symlink setup")
                        val file = File(candidate(root), "index.android.bundle")
                        file.delete(); Files.createSymbolicLink(file.toPath(), outside.toPath())
                    }
                }
                check(manager(root).checkAndDownload().status == "error", "Accepted $target symlink")
                check(outside.readText() == "outside", "Changed external symlink target")
            } finally { outside.delete() }
        }
    }

    private fun failureChecks(parent: File) {
        val envelope = signed()
        val cases = listOf(
            "manifest-http" to "http_status_invalid", "manifest-length" to "content_length_mismatch",
            "bundle-http" to "http_status_invalid", "bundle-header" to "content_length_mismatch",
            "short" to "size_mismatch", "excess" to "download_too_large", "hash" to "hash_mismatch",
            "disconnect" to "network_error",
        )
        for ((name, expected) in cases) withRoot(parent) { root ->
            seedId(root)
            val transport = CodePushTransport { url, _ ->
                val manifest = url.endsWith("manifest.json")
                var bytes = if (manifest) envelope else bundle
                var status = 200
                var length: Long? = bytes.size.toLong()
                if ((manifest && name == "manifest-http") || (!manifest && name == "bundle-http")) status = 302
                if (manifest && name == "manifest-length") length = bytes.size + 1L
                if (!manifest) when (name) {
                    "bundle-header" -> length = bytes.size + 1L
                    "short" -> { bytes = bytes.dropLast(1).toByteArray(); length = null }
                    "excess" -> { bytes += 0; length = null }
                    "hash" -> bytes = bytes.copyOf().also { it[0] = (it[0].toInt() xor 1).toByte() }
                }
                val stream = if (!manifest && name == "disconnect") object : InputStream() {
                    override fun read(): Int = throw IOException("PRIVATE_SENTINEL")
                } else ByteArrayInputStream(bytes)
                CodePushResponse(status, length, stream)
            }
            val result = manager(root, transport = transport).checkAndDownload()
            check(result.status == "error" && result.errorCode == expected, "$name got ${result.errorCode}")
            check(!result.toString().contains("PRIVATE_SENTINEL"), "Exception diagnostic leaked")
            check(runtimeRoot(root).list()?.none { it.startsWith(".download-") } != false, "Temporary file leaked")
        }
        withRoot(parent) { root ->
            seedId(root)
            check(manager(root, disk = { 0L }).checkAndDownload().errorCode == "insufficient_space", "Disk admission")
        }
        withRoot(parent) { root ->
            seedId(root)
            var probes = 0
            val result = manager(root, disk = { if (++probes <= 2) Long.MAX_VALUE else 16L * 1024 * 1024 }).checkAndDownload()
            check(result.errorCode == "insufficient_space", "Disk reserve was crossed while streaming")
            check(File(runtimeRoot(root), "candidates").list()?.isEmpty() == true, "Disk failure published candidate")
        }
        withRoot(parent) { root ->
            seedId(root)
            var ticks = 0L
            val transport = CodePushTransport { _, _ ->
                ticks = 121_000_000_000L
                CodePushResponse(200, envelope.size.toLong(), ByteArrayInputStream(envelope))
            }
            check(manager(root, transport = transport, monotonic = { ticks }).checkAndDownload().errorCode == "download_timeout", "Total deadline")
        }
        withRoot(parent) { root ->
            seedId(root)
            val budgets = mutableListOf<Int>()
            val transport = CodePushTransport { url, remaining ->
                budgets.add(remaining)
                val bytes = if (url.endsWith("manifest.json")) envelope else bundle
                CodePushResponse(200, bytes.size.toLong(), ByteArrayInputStream(bytes))
            }
            check(manager(root, transport = transport).checkAndDownload(6000).status == "downloaded", "Startup download failed")
            check(budgets.size == 2 && budgets.all { it in 1..6000 }, "Startup transport exceeded its operation budget")
        }
        withRoot(parent) { root ->
            seedId(root)
            var ticks = 0L
            var calls = 0
            val transport = CodePushTransport { _, remaining ->
                calls++
                check(remaining in 1..6000, "Short budget was not passed to transport")
                ticks = 6_001_000_000L
                CodePushResponse(200, envelope.size.toLong(), ByteArrayInputStream(envelope))
            }
            check(manager(root, transport = transport, monotonic = { ticks }).checkAndDownload(6000).errorCode == "download_timeout", "Short operation deadline ignored")
            check(calls == 1 && !File(runtimeRoot(root), "candidate.json").exists(), "Expired startup operation published a pointer")
        }
        withRoot(parent) { root ->
            var calls = 0
            val transport = CodePushTransport { _, _ -> calls++; throw AssertionError("Invalid budget touched network") }
            check(manager(root, transport = transport).checkAndDownload(0).errorCode == "download_timeout" && calls == 0, "Invalid operation budget accepted")
        }
        for (state in listOf("install-id.json", "v1/${runtime.nativeRuntimeId}/watermark.json")) withRoot(parent) { root ->
            seedId(root)
            val file = File(root, state)
            file.parentFile.mkdirs(); file.writeText("corrupt")
            check(manager(root).checkAndDownload().errorCode == "state_invalid", "Corrupt $state accepted")
        }
    }

    private fun replayChecks(parent: File) {
        withRoot(parent) { root ->
            seedId(root)
            val stop = signed(basePayload.replace("\"manifestSequence\":1", "\"manifestSequence\":2").replace("\"enabled\":true", "\"enabled\":false"))
            check(manager(root, stop).checkAndDownload().status == "disabled", "Signed stop")
            check(manager(root).checkAndDownload().errorCode == "manifest_replayed", "Stop did not advance watermark")
        }
        withRoot(parent) { root ->
            seedId(root)
            check(manager(root).checkAndDownload().status == "downloaded", "Replay setup")
            val watermark = File(runtimeRoot(root), "watermark.json").readBytes()
            val conflict = signed(basePayload.replace("\"version\":\"1.0.1\"", "\"version\":\"1.0.2\""))
            check(manager(root, conflict).checkAndDownload().errorCode == "manifest_sequence_conflict", "Same-sequence conflict")
            check(File(runtimeRoot(root), "watermark.json").readBytes().contentEquals(watermark), "Conflict changed watermark")
            val expired = signed(basePayload.replace("\"manifestSequence\":1", "\"manifestSequence\":3"))
            check(manager(root, expired, clock = now + 172800000L).checkAndDownload().errorCode == "manifest_expired", "Expired publication")
            check(File(runtimeRoot(root), "watermark.json").readBytes().contentEquals(watermark), "Expired publication changed watermark")
            val newer = signed(basePayload.replace("\"manifestSequence\":1", "\"manifestSequence\":2"))
            check(manager(root, newer).checkAndDownload().status == "downloaded", "Same bundle new publication")
            check(File(runtimeRoot(root), "candidates").list()?.size == 2, "Immutable publication replaced")
        }
    }

    private fun faultChecks(parent: File) {
        for (point in listOf("watermark_before_commit", "watermark_committed", "temporary_created", "bundle_chunk_written",
            "before_candidate_commit", "candidate_committed", "candidate_pointer_before_commit", "candidate_pointer_committed")) {
            withRoot(parent) { root ->
                seedId(root)
                val unrelated = File(runtimeRoot(root), ".download-unrelated/sentinel.txt")
                unrelated.parentFile.mkdirs(); unrelated.writeText("preserve")
                val result = manager(root, fault = { if (it == point) throw IOException("PRIVATE_SENTINEL") }).checkAndDownload()
                check(result.status == "error", "Fault $point did not fail")
                check(unrelated.readText() == "preserve", "Fault $point removed unrelated staging")
                val retry = manager(root).checkAndDownload()
                check(retry.status in setOf("downloaded", "already_downloaded"), "Fault $point unrecoverable: ${retry.errorCode}")
            }
        }
    }

    private fun concurrencyChecks(parent: File) {
        for (sameInstance in listOf(false, true)) withRoot(parent) { root ->
            seedId(root)
            val entered = CountDownLatch(1)
            val release = CountDownLatch(1)
            val envelope = signed()
            val transport = CodePushTransport { url, _ ->
                val manifest = url.endsWith("manifest.json")
                if (!manifest) { entered.countDown(); check(release.await(5, TimeUnit.SECONDS), "Concurrency release timeout") }
                val bytes = if (manifest) envelope else bundle
                CodePushResponse(200, bytes.size.toLong(), ByteArrayInputStream(bytes))
            }
            val first = manager(root, transport = transport)
            val answer = AtomicReference<CodePushDownloadResult>()
            val worker = Thread { answer.set(first.checkAndDownload()) }.apply { start() }
            try {
                check(entered.await(5, TimeUnit.SECONDS), "Concurrency enter timeout")
                val second = if (sameInstance) first else manager(root)
                check(second.checkAndDownload().status == "busy", "Concurrent owner accepted")
            } finally { release.countDown(); worker.join(5000) }
            check(answer.get()?.status == "downloaded", "Busy call disrupted original download")
        }
    }

    private fun abandonedChecks(parent: File) {
        withRoot(parent) { root ->
            seedId(root)
            val runtimeDirectory = runtimeRoot(root).apply { mkdirs() }
            val orphan = File(runtimeDirectory, ".download-11111111-1111-1111-1111-111111111111").apply { mkdir() }
            File(orphan, "index.android.bundle").writeText("interrupted")
            val record = File(runtimeDirectory, ".watermark.json-22222222-2222-2222-2222-222222222222.tmp").apply { writeText("partial") }
            val idRecord = File(root, ".install-id.json-33333333-3333-3333-3333-333333333333.tmp").apply { writeText("partial") }
            val unknown = File(runtimeDirectory, ".download-44444444-4444-4444-4444-444444444444/sentinel.txt")
            unknown.parentFile.mkdir(); unknown.writeText("foreign")
            val outside = File(root.parentFile, "outside.txt").apply { writeText("outside") }
            val suspicious = File(runtimeDirectory, ".download-55555555-5555-5555-5555-555555555555").apply { mkdir() }
            Files.createSymbolicLink(File(suspicious, "index.android.bundle").toPath(), outside.toPath())
            check(manager(root).checkAndDownload().status == "downloaded", "Orphan recovery download")
            check(!orphan.exists() && !record.exists() && !idRecord.exists(), "Owned abandoned files not recovered")
            check(unknown.readText() == "foreign", "Unknown abandoned directory was removed")
            check(Files.isSymbolicLink(File(suspicious, "index.android.bundle").toPath()) && outside.readText() == "outside", "Recovery followed link")
        }
    }

    private fun rolloutChecks(parent: File) {
        val hash = java.security.MessageDigest.getInstance("SHA-256").digest(
            "jaco-driver-codepush-rollout-v1\n${"0".repeat(32)}\njaco-driver\ndownload-fixture-rollout".toByteArray())
        val slot = (java.nio.ByteBuffer.wrap(hash).int.toLong() and 0xffffffffL) % 10000
        for ((basisPoints, status) in listOf(slot to "not_selected", (slot + 1) to "downloaded")) withRoot(parent) { root ->
            seedId(root)
            val envelope = signed(basePayload.replace("\"rolloutBasisPoints\":10000", "\"rolloutBasisPoints\":$basisPoints"))
            check(manager(root, envelope).checkAndDownload().status == status, "Deterministic rollout boundary $basisPoints/$slot")
        }
    }

    private fun productionTransportChecks() {
        val path = "/jaco-driver-codepush/android/${runtime.nativeRuntimeId}/manifest.json"
        for (url in listOf("http://storage.yandexcloud.net$path", "https://other.example$path",
            "https://storage.yandexcloud.net:443$path", "https://user@storage.yandexcloud.net$path",
            "https://storage.yandexcloud.net$path#fragment", "https://storage.yandexcloud.net/other/manifest.json",
            "https://storage.yandexcloud.net/jaco-driver-codepush/android/../../manifest.json")) {
            var code: String? = null
            try { CodePushHttpTransport().get(url, 1000).close() }
            catch (failure: CodePushFailure) { code = failure.code }
            check(code == "url_source_mismatch", "Production transport accepted unsafe URL")
        }
    }

    private fun candidate(root: File): File = File(runtimeRoot(root), "candidates").listFiles()!!.single()
    private fun runtimeRoot(root: File) = File(root, "v1/${runtime.nativeRuntimeId}")
    private fun seedId(root: File, id: String = "0".repeat(32)) {
        root.mkdirs(); File(root, "install-id.json").writeText("{\"installId\":\"$id\"}\n")
    }
    private fun withRoot(parent: File, block: (File) -> Unit) {
        val container = Files.createTempDirectory(parent.toPath(), "android-download-").toFile()
        try { block(File(container, "codepush")) } finally {
            Files.walk(container.toPath()).use { it.sorted(Comparator.reverseOrder()).forEach { path -> Files.deleteIfExists(path) } }
        }
    }
    private fun check(condition: Boolean, message: String) {
        checks++
        if (!condition) throw AssertionError(message)
    }
    private fun decode(value: String): ByteArray = Base64.getDecoder().decode(value)
    private fun encode(value: ByteArray): String = Base64.getEncoder().encodeToString(value)
}
