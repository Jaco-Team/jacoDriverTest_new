package com.jacodrivertest.codepush

import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException
import java.nio.channels.FileChannel
import java.nio.file.Files
import java.nio.file.StandardOpenOption.WRITE
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.Signature
import java.util.Base64
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/** Exercises the actual version selector with private fixture catalogs, never an activation API. */
object CodePushVersionsAndroidTest {
    private val runtime = CodePushRuntime("jaco-driver", "com.jacodrivertest", "android", "a".repeat(64), "97", "0.88.0", "260318099.0.4")
    private val pair = KeyPairGenerator.getInstance("EC").apply { initialize(java.security.spec.ECGenParameterSpec("secp256r1")) }.generateKeyPair()
    private val keys = mapOf("download-test-key" to encode(pair.public.encoded))
    private lateinit var payload: String
    private lateinit var body: ByteArray
    private var now = 0L
    private var assertions = 0
    private data class Ref(val packageSha256: String, val payloadSha256: String, val directory: File)

    @JvmStatic fun main(args: Array<String>) {
        val parent = File(args[1]).also { it.mkdirs() }
        val valid = File(args[0]).readLines().map { it.split('\t') }.first { String(decode(it[0])) == "android/valid" }
        val envelope = CodePushJson.parse(decode(valid[2])) as Map<*, *>
        payload = String(decode(envelope["payloadBase64"] as String), Charsets.UTF_8)
        body = decode(valid[7]); now = valid[4].toLong()
        foundation(parent)
        selection(parent)
        fatalAfterConfirmation(parent)
        invalidVersions(parent)
        invalidCatalogs(parent)
        symlinks(parent)
        hardlinks(parent)
        locksAndBudgets(parent)
        cacheChecks(parent)
        preflightCacheChecks()
        transientFallbackChecks()
        println("Android versions: $assertions assertions passed")
    }

    private fun store(root: File, r: CodePushRuntime = runtime, fault: (String) -> Unit = {},
        monotonic: () -> Long = System::nanoTime) = CodePushVersionStore(root, r,
        { CodePushManifestVerifier.verify(it, keys) }, fault, monotonic)

    private fun foundation(parent: File) {
        withRoot(parent) { root ->
            val foreign = File(root.parentFile, "courier-data.txt").apply { writeText("orders") }
            val result = store(root).select()
            check(result.source == CodePushVersionSource.EMBEDDED && result.bundlePath == null, "Missing catalog fallback")
            check(result.reason == "catalog_initialized", "Catalog was not initialized")
            val raw = CodePushJson.parse(catalogFile(root).readBytes()) as Map<*, *>
            check(raw.keys == setOf("schemaVersion", "nativeRuntimeId", "current", "previous") && raw["current"] == null && raw["previous"] == null, "Unsafe initialized references")
            check(foreign.readText() == "orders", "Changed courier data")
        }
        withRoot(parent) { root ->
            root.mkdirs()
            val envelope = signed(payload)
            val manager = CodePushDownloadManager(root, runtime, { CodePushManifestVerifier.verify(it, keys) },
                CodePushTransport { url, _ ->
                    val bytes = if (url.endsWith("manifest.json")) envelope else body
                    CodePushResponse(200, bytes.size.toLong(), ByteArrayInputStream(bytes))
                }, { now }, { Long.MAX_VALUE })
            check(manager.checkAndDownload().status == "downloaded", "Download setup")
            val pointer = File(runtimeRoot(root), "candidate.json").readBytes()
            check(store(root).select().source == CodePushVersionSource.EMBEDDED, "Candidate activated itself")
            check(File(runtimeRoot(root), "candidate.json").readBytes().contentEquals(pointer), "Candidate pointer rewritten")
        }
        for (point in listOf("versions_before_commit", "versions_initialized")) withRoot(parent) { root ->
            val result = store(root, fault = { if (it == point) throw IOException("PRIVATE_SENTINEL") }).select()
            check(result.source == CodePushVersionSource.EMBEDDED, "Init fault selected OTA")
            val retry = store(root).select()
            check(retry.source == CodePushVersionSource.EMBEDDED && catalogFile(root).isFile, "Init fault not recoverable")
            check(runtimeRoot(root).list()?.none { it.startsWith(".versions.json-") } == true, "Init fault temporary leaked")
        }
        withRoot(parent) { root ->
            val bytes = "foreign catalog sentinel"
            val result = store(root, fault = { if (it == "versions_before_commit") catalogFile(root).writeText(bytes) }).select()
            check(result.source == CodePushVersionSource.EMBEDDED && result.reason == "catalog_invalid", "Init replaced concurrently existing catalog")
            check(catalogFile(root).readText() == bytes, "Init overwrote foreign catalog")
        }
    }

    private fun fatalAfterConfirmation(parent: File) {
        withRoot(parent) { root ->
            val current = candidate(root)
            catalog(root, current)
            val outside = File(root.parentFile, "courier-data.txt").apply { writeText("preserve") }
            val selector = store(root)
            val binding = selector.select()
            check(binding.source == CodePushVersionSource.CURRENT, "Fatal fixture did not select current")
            check(!selector.markFatal(binding.copy(packageId = "wrong")), "Accepted foreign fatal binding")
            check(selector.markFatal(binding), "Fatal current package was not recorded")
            check(selector.select().source == CodePushVersionSource.EMBEDDED, "Fatal current package relaunched")
            val raw = CodePushJson.parse(catalogFile(root).readBytes()) as Map<*, *>
            check((raw["quarantined"] as List<*>).contains(current.packageSha256), "Fatal package not quarantined")
            check((raw["lastEvent"] as Map<*, *>)["code"] == "fatal_after_confirmation", "Missing fatal event")
            check(!selector.markFatal(binding), "Stale fatal binding modified catalog")
            check(outside.readText() == "preserve", "Fatal recovery modified courier data")
        }
    }

    private fun selection(parent: File) {
        withRoot(parent) { root ->
            val current = candidate(root)
            catalog(root, current)
            val before = catalogFile(root).readBytes()
            val selected = store(root).select()
            check(selected.source == CodePushVersionSource.CURRENT && selected.packageId == "${runtime.nativeRuntimeId}:${current.packageSha256}", "Current selection")
            check(File(selected.bundlePath!!).readBytes().contentEquals(body), "Selected different bytes")
            check(catalogFile(root).readBytes().contentEquals(before), "Current selection mutated catalog")
        }
        withRoot(parent) { root ->
            val current = candidate(root)
            val previous = candidate(root, payload.replace("\"manifestSequence\":1", "\"manifestSequence\":2"))
            catalog(root, current, previous)
            File(current.directory, "index.android.bundle").writeText("corrupt")
            check(store(root).select().source == CodePushVersionSource.PREVIOUS, "No valid previous fallback")
            File(previous.directory, "manifest.json").writeText("corrupt")
            check(store(root).select().source == CodePushVersionSource.EMBEDDED, "No embedded fallback")
        }
        withRoot(parent) { root ->
            val expired = payload.replace(Regex("\"issuedAt\":\"[^\"]+\""), "\"issuedAt\":\"2000-01-01T00:00:00Z\"")
                .replace(Regex("\"expiresAt\":\"[^\"]+\""), "\"expiresAt\":\"2000-01-02T00:00:00Z\"")
                .replace("\"enabled\":true", "\"enabled\":false").replace("\"rolloutBasisPoints\":10000", "\"rolloutBasisPoints\":0")
            val ref = candidate(root, expired)
            catalog(root, ref)
            File(runtimeRoot(root), "watermark.json").writeText("newer or corrupt replay state")
            check(store(root).select().source == CodePushVersionSource.CURRENT, "Expired confirmed version rejected")
            try { CodePushManifestValidator.validate(expired.toByteArray(), runtime, now); check(false, "Download admission weakened") }
            catch (failure: CodePushFailure) { check(failure.code == "manifest_expired", "Wrong fresh admission error") }
        }
        withRoot(parent) { root ->
            val ref = candidate(root); catalog(root, ref)
            val next = runtime.copy(nativeRuntimeId = "b".repeat(64), nativeBuild = "98")
            val result = store(root, next).select()
            check(result.source == CodePushVersionSource.EMBEDDED, "New native build reused old OTA")
            check(ref.directory.isDirectory && catalogFile(root).isFile, "Native change removed old data")
        }
    }

    private fun invalidVersions(parent: File) {
        val variations = listOf(
            "schema" to payload.replace("\"schemaVersion\":1", "\"schemaVersion\":2"),
            "build" to payload.replace("\"minNativeBuild\":\"97\"", "\"minNativeBuild\":\"98\"").replace("\"maxNativeBuild\":\"97\"", "\"maxNativeBuild\":\"98\""),
            "runtime" to payload.replace("a".repeat(64), "c".repeat(64)),
            "rn" to payload.replace("\"rnVersion\":\"0.88.0\"", "\"rnVersion\":\"0.87.1\""),
        )
        for ((name, source) in variations) withRoot(parent) { root ->
            val ref = candidate(root, source); catalog(root, ref)
            check(store(root).select().source == CodePushVersionSource.EMBEDDED, "Accepted incompatible $name")
        }
        for (target in listOf("signature", "key", "payload-hash", "metadata", "bundle-hash", "bundle-size", "extra-file")) withRoot(parent) { root ->
            val ref = candidate(root); catalog(root, ref)
            when (target) {
                "signature" -> File(ref.directory, "manifest.json").writeText("{}")
                "key" -> File(ref.directory, "manifest.json").writeText(String(signed(payload)).replace("download-test-key", "untrusted-key"))
                "payload-hash" -> {
                    val file = File(ref.directory, "manifest.json")
                    file.writeBytes(signed(payload + " "))
                }
                "metadata" -> File(ref.directory, "metadata.json").appendText("{}")
                "bundle-hash" -> File(ref.directory, "index.android.bundle").writeBytes(body.copyOf().also { it[0] = (it[0].toInt() xor 1).toByte() })
                "bundle-size" -> File(ref.directory, "index.android.bundle").appendText("extra")
                "extra-file" -> File(ref.directory, "foreign.txt").writeText("preserve")
            }
            val before = catalogFile(root).readBytes()
            check(store(root).select().source == CodePushVersionSource.EMBEDDED, "Accepted $target")
            check(catalogFile(root).readBytes().contentEquals(before) && ref.directory.exists(), "Deleted invalid $target")
        }
    }

    private fun invalidCatalogs(parent: File) {
        for (kind in listOf("broken", "schema", "runtime", "traversal", "extra", "duplicate", "null-with-backup", "same-ref", "missing-current")) withRoot(parent) { root ->
            val ref = candidate(root); catalog(root, ref)
            val file = catalogFile(root)
            val normal = file.readText()
            file.writeText(when (kind) {
                "broken" -> "not-json"
                "schema" -> normal.replace("\"schemaVersion\":1", "\"schemaVersion\":2")
                "runtime" -> normal.replace(runtime.nativeRuntimeId, "f".repeat(64))
                "traversal" -> normal.replace(ref.packageSha256, "../outside")
                "extra" -> normal.replaceFirst("{", "{\"extra\":true,")
                "duplicate" -> normal.replaceFirst("{", "{\"schemaVersion\":1,")
                "null-with-backup" -> catalogText(null, ref)
                "same-ref" -> catalogText(ref, ref)
                else -> "{\"schemaVersion\":1,\"nativeRuntimeId\":\"${runtime.nativeRuntimeId}\",\"previous\":null}"
            })
            val before = file.readBytes()
            check(store(root).select().source == CodePushVersionSource.EMBEDDED, "Accepted invalid catalog $kind")
            check(file.readBytes().contentEquals(before), "Overwrote invalid catalog $kind")
        }
    }

    private fun symlinks(parent: File) {
        for (target in listOf("catalog", "candidates-parent", "candidate", "manifest.json", "metadata.json", "index.android.bundle", "root", "lock")) withRoot(parent) { root ->
            val ref = candidate(root); catalog(root, ref)
            val outside = File(root.parentFile, "outside").apply { mkdir() }
            val sentinel = File(outside, "sentinel").apply { writeText("preserve") }
            val path = when (target) {
                "catalog" -> catalogFile(root)
                "candidates-parent" -> ref.directory.parentFile!!
                "candidate" -> ref.directory
                "root" -> root
                "lock" -> File(root, ".manager.lock")
                else -> File(ref.directory, target)
            }
            if (path.exists()) path.deleteRecursively()
            Files.createSymbolicLink(path.toPath(), outside.toPath())
            check(store(root).select().source == CodePushVersionSource.EMBEDDED, "Followed $target symlink")
            check(sentinel.readText() == "preserve", "Changed $target target")
        }
    }

    private fun locksAndBudgets(parent: File) {
        withRoot(parent) { root ->
            root.mkdirs()
            FileChannel.open(File(root, ".manager.lock").toPath(), java.nio.file.StandardOpenOption.CREATE, WRITE).use { channel ->
                channel.lock().use {
                    check(store(root).select().reason == "lock_busy", "Startup waited for downloader lock")
                    check(!catalogFile(root).exists(), "Busy startup initialized catalog")
                }
            }
        }
        withRoot(parent) { root ->
            val current = candidate(root)
            val previous = candidate(root, payload + " ")
            catalog(root, current, previous)
            var elapsed = 0L
            val calls = AtomicInteger()
            val s = CodePushVersionStore(root, runtime, {
                calls.incrementAndGet(); elapsed = 1_500_000_000L
                CodePushManifestVerifier.verify(it, keys)
            }, monotonicNanos = { elapsed })
            check(s.select().reason == "startup_timeout", "Shared core deadline ignored")
            check(calls.get() == 1, "Previous verified after shared deadline")
        }
    }

    private fun hardlinks(parent: File) {
        for (target in listOf("catalog", "manifest.json", "metadata.json", "index.android.bundle")) withRoot(parent) { root ->
            val ref = candidate(root); catalog(root, ref)
            val path = if (target == "catalog") catalogFile(root) else File(ref.directory, target)
            val outside = File(root.parentFile, "outside-hardlink")
            outside.writeBytes(path.readBytes())
            Files.delete(path.toPath())
            Files.createLink(path.toPath(), outside.toPath())
            val before = outside.readBytes()
            check(store(root).select().source == CodePushVersionSource.EMBEDDED, "Accepted $target hardlink")
            check(outside.readBytes().contentEquals(before), "Changed $target hardlink target")
        }
    }

    private fun cacheChecks(parent: File) {
        var calls = 0
        val debug = CodePushStartupCache()
        check(debug.select(true) { calls++; throw AssertionError("Debug touched storage") }.reason == "debug_metro", "Debug fallback")
        check(calls == 0, "Debug factory invoked")
        val cached = CodePushStartupCache()
        val first = cached.select(false) { calls++; CodePushVersionSelection(CodePushVersionSource.EMBEDDED, reason = "first") }
        check(cached.select(false) { throw AssertionError("Cache recomputed") } === first, "Embedded choice not cached")
        withRoot(parent) { root ->
            val ref = candidate(root); catalog(root, ref)
            val selector = CodePushStartupCache()
            val chosen = selector.select(false) { store(root).select() }
            catalog(root, null)
            check(selector.select(false) { store(root).select() } === chosen && chosen.source == CodePushVersionSource.CURRENT, "Choice changed within process")
        }
        val started = CountDownLatch(1)
        val release = CountDownLatch(1)
        val completed = CountDownLatch(1)
        val timeout = CodePushStartupCache(30)
        val answer = timeout.select(false) {
            started.countDown()
            while (true) {
                try { if (release.await(1, TimeUnit.SECONDS)) break } catch (_: InterruptedException) { }
            }
            completed.countDown()
            CodePushVersionSelection(CodePushVersionSource.CURRENT, "/late", reason = "late")
        }
        check(started.count == 0L && answer.source == CodePushVersionSource.EMBEDDED && answer.reason == "startup_timeout", "Outer startup deadline")
        release.countDown(); check(completed.await(2, TimeUnit.SECONDS), "Late factory did not finish")
        check(timeout.select(false) { throw AssertionError("Timeout retried") } === answer, "Late completion replaced frozen fallback")
        val concurrent = CodePushStartupCache()
        val count = AtomicInteger()
        val a = AtomicReference<CodePushVersionSelection>()
        val b = AtomicReference<CodePushVersionSelection>()
        val factory = { count.incrementAndGet(); CodePushVersionSelection(CodePushVersionSource.EMBEDDED, reason = "once") }
        val t1 = Thread { a.set(concurrent.select(false, factory)) }.apply { start() }
        val t2 = Thread { b.set(concurrent.select(false, factory)) }.apply { start() }
        t1.join(); t2.join()
        check(count.get() == 1 && a.get() === b.get(), "Concurrent cache computed twice")
    }

    private fun preflightCacheChecks() {
        val baseline = CodePushVersionSelection(CodePushVersionSource.CURRENT, "/working", reason = "current_valid")
        var calls = 0
        val immediate = CodePushPreflightCache()
        val prepared = immediate.prepare({ baseline }) {
            calls++
            CodePushPreflightResult(baseline, true)
        }
        check(prepared.allowTrial && prepared.baseline === baseline, "Timely preflight was not accepted")
        check(immediate.prepare({ null }) { throw AssertionError("Preflight repeated") } === prepared && calls == 1, "Preflight did not freeze once")
        val revoked = immediate.disallowTrial(baseline)
        check(!revoked.allowTrial && revoked.baseline === baseline && immediate.peek() === revoked,
            "External intent did not revoke a completed preflight")
        check(immediate.prepare({ null }) { throw AssertionError("External intent retried preflight") } === revoked,
            "A later ordinary intent re-enabled a revoked opening")

        val started = CountDownLatch(1)
        val release = CountDownLatch(1)
        val finished = CountDownLatch(1)
        val timed = CodePushPreflightCache(30)
        val fallback = timed.prepare({ baseline }) {
            started.countDown()
            while (true) { try { if (release.await(1, TimeUnit.SECONDS)) break } catch (_: InterruptedException) { } }
            finished.countDown()
            CodePushPreflightResult(baseline, true)
        }
        check(started.count == 0L && !fallback.allowTrial && fallback.baseline.source == CodePushVersionSource.CURRENT, "Timed-out preflight lost its working version")
        release.countDown()
        check(finished.await(2, TimeUnit.SECONDS), "Late preflight worker did not finish")
        check(timed.peek() === fallback && timed.prepare({ baseline }) { throw AssertionError("Timeout retried") } === fallback, "Late preflight enabled activation")

        val running = CodePushPreflightCache()
        val entered = CountDownLatch(1)
        val continueWork = CountDownLatch(1)
        val completed = CountDownLatch(1)
        val answer = AtomicReference<CodePushPreflightResult>()
        val waiter = Thread {
            answer.set(running.prepare({ baseline }) {
                entered.countDown()
                while (true) { try { if (continueWork.await(1, TimeUnit.SECONDS)) break } catch (_: InterruptedException) { } }
                completed.countDown()
                CodePushPreflightResult(baseline, true)
            })
        }.apply { start() }
        check(entered.await(2, TimeUnit.SECONDS), "Concurrent preflight did not start")
        check(running.peek() == null, "In-progress preflight invented a completed outcome")
        val frozen = running.disallowTrial(baseline)
        check(!frozen.allowTrial && frozen.baseline.source == CodePushVersionSource.CURRENT,
            "External intent did not freeze the in-progress opening")
        continueWork.countDown()
        waiter.join(2000)
        check(!waiter.isAlive && completed.await(2, TimeUnit.SECONDS) && answer.get() === frozen && running.peek() === frozen, "In-flight preflight replaced a direct-entry decision")
    }

    private fun transientFallbackChecks() {
        val current = CodePushVersionSelection(CodePushVersionSource.CURRENT, "/working", packageId = "working",
            version = "1.0.1", reason = "current_valid")
        val previous = current.copy(source = CodePushVersionSource.PREVIOUS, reason = "previous_valid")
        for (reason in listOf("startup_timeout", "lock_busy")) for (baseline in listOf(current, previous)) {
            val failure = CodePushVersionSelection(CodePushVersionSource.EMBEDDED, reason = reason)
            val recovered = failure.withVerifiedStartupFallback(baseline)
            check(recovered.source == baseline.source && recovered.bundlePath == baseline.bundlePath &&
                recovered.packageId == baseline.packageId && recovered.reason == reason && recovered.attemptId.isEmpty(),
                "Transient selector failure lost the verified preflight baseline")
            check(failure.withVerifiedStartupFallback(null) === failure, "Missing verified baseline invented an OTA path")
            check(failure.withVerifiedStartupFallback(current.copy(source = CodePushVersionSource.TRIAL, attemptId = "a".repeat(32))) === failure,
                "An unconfirmed trial was accepted as timeout fallback")
        }
        for (reason in listOf("catalog_invalid", "runtime_invalid", "versions_unavailable", "storage_invalid",
                "storage_error", "selection_failed", "hash_mismatch", "signature_invalid")) {
            val failed = CodePushVersionSelection(CodePushVersionSource.EMBEDDED, reason = reason)
            check(failed.withVerifiedStartupFallback(current) === failed,
                "Integrity/storage failure was hidden by the preflight baseline: $reason")
        }
        val selected = previous.copy(reason = "startup_timeout")
        check(selected.withVerifiedStartupFallback(current) === selected, "Existing selector choice was replaced")
    }

    private fun candidate(root: File, source: String = payload): Ref {
        val data = CodePushJson.parse(source.toByteArray()) as Map<*, *>
        val pack = data["package"] as Map<*, *>
        val ref = Ref(pack["sha256"] as String, hash(source.toByteArray()),
            File(runtimeRoot(root), "candidates/${pack["sha256"]}-${hash(source.toByteArray())}"))
        ref.directory.mkdirs()
        File(ref.directory, "index.android.bundle").writeBytes(body)
        File(ref.directory, "manifest.json").writeBytes(signed(source))
        File(ref.directory, "metadata.json").writeText("{\"manifestSequence\":${data["manifestSequence"]},\"nativeRuntimeId\":\"${data["nativeRuntimeId"]}\",\"packageSha256\":\"${ref.packageSha256}\",\"payloadSha256\":\"${ref.payloadSha256}\",\"size\":${pack["size"]},\"version\":\"${data["version"]}\"}\n")
        return ref
    }
    private fun signed(source: String): ByteArray {
        val bytes = source.toByteArray()
        val signature = Signature.getInstance("SHA256withECDSA").apply {
            initSign(pair.private); update("jaco-driver-codepush-manifest-v1\n".toByteArray()); update(bytes)
        }.sign()
        return "{\"keyId\":\"download-test-key\",\"payloadBase64\":\"${encode(bytes)}\",\"signatureBase64\":\"${encode(signature)}\"}".toByteArray()
    }
    private fun catalog(root: File, current: Ref?, previous: Ref? = null) {
        catalogFile(root).also { it.parentFile.mkdirs(); it.writeText(catalogText(current, previous)) }
    }
    private fun catalogText(current: Ref?, previous: Ref?): String {
        fun ref(value: Ref?) = if (value == null) "null" else "{\"packageSha256\":\"${value.packageSha256}\",\"payloadSha256\":\"${value.payloadSha256}\"}"
        return "{\"schemaVersion\":1,\"nativeRuntimeId\":\"${runtime.nativeRuntimeId}\",\"current\":${ref(current)},\"previous\":${ref(previous)}}\n"
    }
    private fun runtimeRoot(root: File) = File(root, "v1/${runtime.nativeRuntimeId}")
    private fun catalogFile(root: File) = File(runtimeRoot(root), "versions.json")
    private fun check(condition: Boolean, message: String) { assertions++; if (!condition) throw AssertionError(message) }
    private fun hash(value: ByteArray) = MessageDigest.getInstance("SHA-256").digest(value).joinToString("") { "%02x".format(it.toInt() and 255) }
    private fun decode(value: String): ByteArray = Base64.getDecoder().decode(value)
    private fun encode(value: ByteArray): String = Base64.getEncoder().encodeToString(value)
    private fun withRoot(parent: File, block: (File) -> Unit) {
        val container = Files.createTempDirectory(parent.toPath(), "android-versions-").toFile()
        try { block(File(container, "codepush")) } finally {
            Files.walk(container.toPath()).use { it.sorted(Comparator.reverseOrder()).forEach { path -> Files.deleteIfExists(path) } }
        }
    }
}
