package com.jacodrivertest.codepush

import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.Signature
import java.util.Base64
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import java.io.ByteArrayInputStream

/** Real journal/crypto/filesystem tests. Candidate JavaScript is never evaluated by this harness. */
object CodePushLifecycleAndroidTest {
    private val runtime = CodePushRuntime("jaco-driver", "com.jacodrivertest", "android", "a".repeat(64), "97", "0.88.0", "260318099.0.4")
    private val process = "1".repeat(32)
    private val nextProcess = "2".repeat(32)
    private val pair = KeyPairGenerator.getInstance("EC").apply { initialize(java.security.spec.ECGenParameterSpec("secp256r1")) }.generateKeyPair()
    private val keys = mapOf("download-test-key" to encode(pair.public.encoded))
    private lateinit var base: String
    private lateinit var candidateBody: ByteArray
    private var now = 0L
    private var checks = 0
    private data class Ref(val sha: String, val payload: String, val folder: File, val source: String)

    @JvmStatic fun main(args: Array<String>) {
        val valid = File(args[0]).readLines().map { it.split('\t') }.first { String(decode(it[0])) == "android/valid" }
        val envelope = CodePushJson.parse(decode(valid[2])) as Map<*, *>
        base = String(decode(envelope["payloadBase64"] as String)); candidateBody = decode(valid[7]); now = valid[4].toLong()
        val parent = File(args[1]).also { it.mkdirs() }
        provenance(parent)
        confirmation(parent)
        lateFatal(parent)
        malformedState(parent)
        recovery(parent)
        controls(parent)
        faults(parent)
        coldOpening(parent)
        println("Android lifecycle: $checks assertions passed")
    }

    private fun store(root: File, token: String = process, fault: (String) -> Unit = {}, at: Long = now,
        active: () -> Boolean = { true }, publish: (CodePushVersionSelection) -> Unit = {},
        monotonic: () -> Long = System::nanoTime) =
        CodePushVersionStore(root, runtime, { CodePushManifestVerifier.verify(it, keys) }, fault = fault,
            processToken = token, clock = { at }, selectionActive = active, onVerifiedBaseline = publish,
            monotonicNanos = monotonic)

    private fun lateFatal(parent: File) {
        withRoot(parent) { root ->
            val previous = baseline(root)
            val broken = candidate(root, "global.lateFatal = true;\n".toByteArray(), 3)
            writeV1(root, broken, previous)
            val selected = store(root).select()
            check(selected.packageId.endsWith(broken.sha), "Fatal setup did not select current")
            check(store(root).markFatal(selected), "Fatal current was not marked")
            val after = state(root)
            check(after["current"] == refObject(previous) && after["previous"] == null, "Fatal did not restore previous")
            check((after["quarantined"] as List<*>).contains(broken.sha), "Fatal was not quarantined")
            check(store(root).select().packageId.endsWith(previous.sha), "Previous did not start after fatal")
        }
    }

    private fun provenance(parent: File) {
        withRoot(parent) { root ->
            val baseline = baseline(root)
            val c = candidate(root); pointer(root, c)
            val raw = catalog(root).readBytes()
            val selected = store(root).select()
            check(selected.source == CodePushVersionSource.CURRENT && selected.packageId.endsWith(baseline.sha), "Default startup admitted trial")
            check(catalog(root).readBytes().contentEquals(raw), "Read-only startup upgraded v1")
            for (ordinary in listOf(false, false)) {
                val signal = CodePushLaunchProvenance()
                signal.record(ordinary)
                check(store(root).select(signal.allowsTrial()).source == CodePushVersionSource.CURRENT, "Background/deep-link admitted trial")
                signal.record(true)
                check(!signal.allowsTrial(), "Later intent changed opening provenance")
            }
            check(!CodePushLaunchProvenance().allowsTrial(), "Unknown provenance admitted trial")
            val early = CodePushLaunchProvenance()
            val snapshot = early.freezeEligibility()
            early.record(true)
            check(!snapshot && !early.allowsTrial(), "Late activity enabled an already requested background startup")
            val launcher = CodePushLaunchProvenance().apply { record(true) }
            check(launcher.freezeEligibility(), "Ordinary opening lost eligibility before worker")
        }
    }

    private fun malformedState(parent: File) {
        for (kind in listOf("current-target", "foreign-fallback", "blocked", "quarantined")) withRoot(parent) { root ->
            baseline(root); val target = candidate(root); pointer(root, target)
            val s = store(root)
            val trial = s.select(true)
            val original = state(root)
            val pending = original["pending"] as Map<*, *>
            val changed = when (kind) {
                "current-target" -> original + ("current" to refObject(target))
                "foreign-fallback" -> original + ("pending" to (pending + ("fallback" to mapOf("packageSha256" to "e".repeat(64), "payloadSha256" to "f".repeat(64)))))
                "blocked" -> original + ("activationBlocked" to true)
                else -> original + ("quarantined" to listOf(target.sha))
            }
            writeState(root, changed)
            val before = catalog(root).readBytes()
            val result = s.confirmLaunch(trial, trial.attemptId)
            check(result.status == "error" && result.errorCode == if (kind in listOf("blocked", "quarantined")) "activation_blocked" else "state_invalid", "Malformed/blocked pending confirmed: $kind")
            check(catalog(root).readBytes().contentEquals(before), "Rejected pending changed state: $kind")
            if (kind in listOf("current-target", "foreign-fallback")) {
                val selected = store(root, nextProcess).select(true)
                check(selected.source == CodePushVersionSource.EMBEDDED && selected.reason == "catalog_invalid", "Malformed pending catalog admitted: $kind")
                check(catalog(root).readBytes().contentEquals(before), "Malformed catalog overwritten: $kind")
            }
        }
    }

    private fun confirmation(parent: File) {
        withRoot(parent) { root ->
            val old = baseline(root)
            val target = candidate(root); pointer(root, target)
            val s = store(root)
            val trial = s.select(true)
            check(trial.source == CodePushVersionSource.TRIAL && trial.attemptId.length == 32, "No trial selection")
            val state = state(root)
            val pending = state["pending"] as Map<*, *>
            check(state["schemaVersion"] == 2L && state["current"] == refObject(old), "Trial promoted current before confirmation")
            check(pending["attemptId"] == trial.attemptId && pending["candidate"] == refObject(target) && pending["fallback"] == refObject(old), "Pending not durable before returned path")
            val before = catalog(root).readBytes()
            check(s.confirmLaunch(trial, "f".repeat(32)).status == "error", "Wrong attempt confirmed")
            check(store(root, nextProcess).confirmLaunch(trial, trial.attemptId).status == "error", "Cross-process confirmation")
            check(s.confirmLaunch(trial.copy(payloadSha256 = "f".repeat(64)), trial.attemptId).status == "error", "Wrong ref confirmed")
            check(s.confirmLaunch(trial.copy(source = CodePushVersionSource.CURRENT), trial.attemptId).status == "error", "Nontrial confirmed")
            check(s.confirmLaunch(trial, trial.attemptId) { false }.status == "error", "Invalidated module confirmed")
            check(catalog(root).readBytes().contentEquals(before), "Invalid confirmation changed journal")
            val confirmed = s.confirmLaunch(trial, trial.attemptId)
            check(confirmed.status == "confirmed" && confirmed.source == "trial" && confirmed.attemptId == trial.attemptId, "Confirmation result mutated launch binding")
            val done = state(root)
            check(done["current"] == refObject(target) && done["previous"] == refObject(old) && done["pending"] == null, "Confirmation journal not atomic")
            check((done["lastEvent"] as Map<*, *>)["code"] == "confirmed", "No confirmation event")
            val bytes = catalog(root).readBytes()
            check(s.confirmLaunch(trial, trial.attemptId).status == "confirmed", "Confirmation retry not idempotent")
            check(catalog(root).readBytes().contentEquals(bytes), "Idempotent confirm rewrote journal")
            check(store(root, nextProcess, at = now + 172800000).select(true).source == CodePushVersionSource.CURRENT, "Confirmed version expired or retried as candidate")
        }
        withRoot(parent) { root ->
            val previous = baseline(root)
            val broken = candidate(root, "global.brokenBaseline = true;\n".toByteArray(), 3)
            writeV1(root, broken, previous)
            File(broken.folder, "index.android.bundle").writeText("corrupt")
            val target = candidate(root); pointer(root, target)
            val s = store(root)
            val trial = s.select(true)
            check(trial.source == CodePushVersionSource.TRIAL, "Valid previous could not protect trial")
            check((state(root)["pending"] as Map<*, *>)["fallback"] == refObject(previous), "Fallback was not actually verified previous")
            check(s.confirmLaunch(trial, trial.attemptId).status == "confirmed", "Previous-backed confirmation")
            check(state(root)["previous"] == refObject(previous), "Invalid current became backup")
        }
    }

    private fun recovery(parent: File) {
        withRoot(parent) { root ->
            val old = baseline(root)
            val target = candidate(root, "throw new Error('candidate never evaluated by host');\n".toByteArray()); pointer(root, target)
            val trial = store(root).select(true)
            check(trial.source == CodePushVersionSource.TRIAL, "Recovery setup")
            val recovered = store(root, nextProcess).select(true)
            check(recovered.source == CodePushVersionSource.CURRENT && recovered.packageId.endsWith(old.sha), "Unconfirmed launch not rolled back")
            val state = state(root)
            check(state["pending"] == null && (state["quarantined"] as List<*>).contains(target.sha), "Failure hash not quarantined")
            check((state["lastEvent"] as Map<*, *>)["code"] == "launch_unconfirmed", "Claimed a crash without evidence")
            check(store(root).confirmLaunch(trial, trial.attemptId).status == "error", "Recovered attempt later confirmed")
            val republished = candidate(root, File(target.folder, "index.android.bundle").readBytes(), 8)
            pointer(root, republished)
            check(store(root).select(true).source == CodePushVersionSource.CURRENT, "Republishing same failed bytes bypassed quarantine")
        }
        withRoot(parent) { root ->
            baseline(root)
            val target = candidate(root); pointer(root, target)
            store(root).select(true)
            val before = catalog(root).readBytes()
            val failed = store(root, nextProcess, fault = { if (it == "lifecycle_before_commit") throw IOException("fault") }).select(true)
            check(failed.source == CodePushVersionSource.CURRENT && failed.reason == "recovery_write_failed", "Recovery write failure lost verified baseline")
            check(catalog(root).readBytes().contentEquals(before), "Failed recovery changed state")
            check(store(root, nextProcess).select(true).source == CodePushVersionSource.CURRENT, "Recovery retried trial in same startup")
        }
        withRoot(parent) { root ->
            baseline(root); val target = candidate(root); pointer(root, target)
            store(root).select(true)
            val original = state(root)
            val full = (0 until 64).map { it.toString(16).padStart(64, '0') }
            writeState(root, original + ("quarantined" to full))
            store(root, nextProcess).select(true)
            val recovered = state(root)
            check(recovered["activationBlocked"] == true && recovered["quarantined"] == full, "Quarantine overflow evicted known failures")
            val fresh = candidate(root, "global.fresh = true;\n".toByteArray(), 9); pointer(root, fresh)
            check(store(root).select(true).source == CodePushVersionSource.CURRENT, "Blocked state allowed another trial")
        }
    }

    private fun controls(parent: File) {
        for (kind in listOf("expired", "disabled", "rollout", "watermark", "missing-watermark", "install-id", "metadata", "body", "same-current", "same-previous")) withRoot(parent) { root ->
            val old = baseline(root)
            var source: String? = null
            if (kind == "expired") source = payload(candidateBody, 2).replace(Regex("\"expiresAt\":\"[^\"]+\""), "\"expiresAt\":\"2026-10-23T08:59:59.000Z\"")
            if (kind == "disabled") source = payload(candidateBody, 2).replace("\"enabled\":true", "\"enabled\":false")
            if (kind == "rollout") source = payload(candidateBody, 2).replace("\"rolloutBasisPoints\":10000", "\"rolloutBasisPoints\":0")
            val target = if (kind == "same-current") old else candidate(root, source = source)
            if (kind == "same-previous") {
                val current = candidate(root, "global.otherCurrent = true;\n".toByteArray(), 3)
                writeV1(root, current, target)
            }
            pointer(root, target)
            when (kind) {
                "watermark" -> File(runtimeRoot(root), "watermark.json").writeText("{\"manifestSequence\":99,\"payloadSha256\":\"${"f".repeat(64)}\"}")
                "missing-watermark" -> File(runtimeRoot(root), "watermark.json").delete()
                "install-id" -> File(root, "install-id.json").writeText("corrupt")
                "metadata" -> File(target.folder, "metadata.json").writeText("corrupt")
                "body" -> File(target.folder, "index.android.bundle").appendText("corrupt")
            }
            val result = store(root).select(true)
            check(result.source == CodePushVersionSource.CURRENT, "Rejected candidate $kind lost baseline: ${result.source}")
            check(state(root)["schemaVersion"] == 1L, "Rejected candidate $kind mutated lifecycle")
        }
    }

    private fun faults(parent: File) {
        for (point in listOf("lifecycle_before_commit", "lifecycle_committed")) withRoot(parent) { root ->
            baseline(root); val target = candidate(root); pointer(root, target)
            val failed = store(root, fault = { if (it == point) throw IOException("PRIVATE_SENTINEL") }).select(true)
            check(failed.source == CodePushVersionSource.CURRENT, "Trial commit fault selected unrecorded JS")
            check(!failed.toString().contains("PRIVATE_SENTINEL"), "Fault diagnostics leaked")
            if (point == "lifecycle_committed") {
                check(state(root)["pending"] == null, "Unissued failed trial left a pending attempt")
                check((state(root)["quarantined"] as List<*>).isEmpty() && state(root)["lastEvent"] == null, "Unissued failed trial was labelled a crash")
            } else check(state(root)["schemaVersion"] == 1L, "Failed commit upgraded v1")
        }
        for (point in listOf("lifecycle_before_commit", "lifecycle_committed")) withRoot(parent) { root ->
            baseline(root); val target = candidate(root); pointer(root, target)
            val trial = store(root).select(true)
            val once = AtomicBoolean(false)
            val s = store(root, fault = { if (it == point && once.compareAndSet(false, true)) throw IOException("fault") })
            check(s.confirmLaunch(trial, trial.attemptId).status == "error", "Confirmation fault ignored")
            check(s.confirmLaunch(trial, trial.attemptId).status == "confirmed", "Confirmation fault not recoverable/idempotent")
        }
        withRoot(parent) { root ->
            val old = baseline(root); val target = candidate(root); pointer(root, target)
            val verified = store(root).select(false)
            val committed = CountDownLatch(1); val release = CountDownLatch(1); val completed = CountDownLatch(1)
            val cache = CodePushStartupCache(200)
            val chosen = cache.selectWithFallback(false, { verified }, { store(root).rejectUnlaunchedTrial(it) }) {
                val answer = store(root, fault = {
                    if (it == "lifecycle_committed") {
                        committed.countDown()
                        while (true) { try { if (release.await(1, TimeUnit.SECONDS)) break } catch (_: InterruptedException) { } }
                    }
                }, active = { cache.selectionIsActive() }).select(true)
                completed.countDown(); answer
            }
            check(committed.count == 0L && chosen.source == CodePushVersionSource.CURRENT && chosen.packageId.endsWith(old.sha), "Outer timeout selected late trial or lost baseline")
            release.countDown(); check(completed.await(2, TimeUnit.SECONDS), "Late writer did not finish")
            check(cache.peek() === chosen && state(root)["pending"] == null, "Late writer changed frozen choice or left pending")
            check((state(root)["quarantined"] as List<*>).isEmpty() && state(root)["lastEvent"] == null, "Unexecuted late trial was labelled a failed launch")
        }
    }

    private fun coldOpening(parent: File) {
        withRoot(parent) { root ->
            val old = baseline(root)
            val source = payload(candidateBody, 2)
            val network = CodePushDownloadManager(root, runtime, { CodePushManifestVerifier.verify(it, keys) },
                CodePushTransport { url, remaining ->
                    check(remaining in 1..120000, "Preflight downloader lost its bounded lifetime")
                    val bytes = if (url.endsWith("manifest.json")) signed(source) else candidateBody
                    CodePushResponse(200, bytes.size.toLong(), ByteArrayInputStream(bytes))
                }, clock = { now }, availableBytes = { Long.MAX_VALUE })
            val preflight = CodePushColdPreflight().prepare(true,
                selectBaseline = { store(root).select(false) }, publishBaseline = {},
                download = { network.checkAndDownload() })
            check(preflight.allowTrial && preflight.baseline.packageId.endsWith(old.sha), "Preflight lost the verified baseline")
            check(state(root)["schemaVersion"] == 1L && state(root)["pending"] == null, "Native-only preflight created a trial before RN")
            val s = store(root)
            val selected = s.select(preflight.allowTrial)
            check(selected.source == CodePushVersionSource.TRIAL && selected.version == "1.0.2", "Fresh download did not run in the same opening")
            check(s.confirmLaunch(selected, selected.attemptId).status == "confirmed", "Same-opening trial did not confirm normally")
        }
        withRoot(parent) { root ->
            val old = baseline(root)
            val target = candidate(root); pointer(root, target)
            var downloads = 0
            val preflight = CodePushColdPreflight().prepare(true,
                selectBaseline = { store(root).select(false) }, publishBaseline = {},
                download = { downloads++; CodePushDownloadResult("error", "network_error") })
            check(downloads == 1 && preflight.allowTrial, "Offline preflight rejected an already verified local candidate")
            check(state(root)["current"] == refObject(old) && state(root)["pending"] == null, "Preflight mutated the version journal")
            check(store(root).select(preflight.allowTrial).source == CodePushVersionSource.TRIAL, "Cached offline candidate could not run")
        }
        for (status in listOf("disabled", "not_selected", "busy")) withRoot(parent) { root ->
            val old = baseline(root)
            val target = candidate(root); pointer(root, target)
            val prepared = CodePushColdPreflight().prepare(true,
                selectBaseline = { store(root).select(false) }, publishBaseline = {},
                download = { CodePushDownloadResult(status) })
            check(!prepared.allowTrial && prepared.baseline.packageId.endsWith(old.sha), "$status did not preserve the baseline")
            check(state(root)["pending"] == null, "$status admitted a trial in preflight")
        }
        withRoot(parent) { root ->
            val old = baseline(root)
            val target = candidate(root); pointer(root, target)
            val prepared = CodePushColdPreflight().prepare(false,
                selectBaseline = { store(root).select(false) }, publishBaseline = {},
                download = { throw AssertionError("External opening used network") })
            check(!prepared.allowTrial && prepared.baseline.packageId.endsWith(old.sha), "External opening changed the code")
        }
        withRoot(parent) { root ->
            val old = baseline(root)
            val target = candidate(root); pointer(root, target)
            store(root).select(true)
            val prepared = CodePushColdPreflight().prepare(true,
                selectBaseline = { store(root, nextProcess).select(false) }, publishBaseline = {},
                download = { throw AssertionError("Recovery tried another update in this opening") })
            check(!prepared.allowTrial && prepared.baseline.reason == "launch_unconfirmed" && prepared.baseline.packageId.endsWith(old.sha), "Recovery did not freeze its safe baseline")
        }
        withRoot(parent) { root ->
            val old = baseline(root)
            var ticks = 0L
            val prepared = CodePushColdPreflight(monotonicNanos = { ticks }).prepare(true,
                selectBaseline = { store(root).select(false) }, publishBaseline = {},
                download = { ticks = 8_001_000_000L; CodePushDownloadResult("downloaded") })
            check(!prepared.allowTrial && prepared.baseline.packageId.endsWith(old.sha), "Late preflight changed the selected code")
            check(state(root)["schemaVersion"] == 1L, "Late preflight wrote lifecycle state")
        }
        withRoot(parent) { root ->
            val old = baseline(root)
            val source = payload(candidateBody, 2)
            val entered = CountDownLatch(1)
            val release = CountDownLatch(1)
            val completed = CountDownLatch(1)
            val remembered = AtomicReference<CodePushVersionSelection?>()
            val gate = CodePushPreflightCache(200)
            val downloader = CodePushDownloadManager(root, runtime, { CodePushManifestVerifier.verify(it, keys) },
                CodePushTransport { url, _ ->
                    val manifest = url.endsWith("manifest.json")
                    if (!manifest) {
                        entered.countDown()
                        check(release.await(3, TimeUnit.SECONDS), "Late downloader was not released")
                    }
                    val bytes = if (manifest) signed(source) else candidateBody
                    CodePushResponse(200, bytes.size.toLong(), ByteArrayInputStream(bytes))
                }, clock = { now }, availableBytes = { Long.MAX_VALUE })
            val frozen = gate.prepare({ remembered.get() }) {
                val result = CodePushColdPreflight(selectionActive = { gate.preparationIsActive() }).prepare(true,
                    selectBaseline = { store(root).select(false) },
                    publishBaseline = { remembered.set(it) },
                    download = { downloader.checkAndDownload() })
                completed.countDown()
                result
            }
            check(entered.count == 0L && !frozen.allowTrial && frozen.baseline.packageId.endsWith(old.sha), "Slow download did not freeze the working baseline")
            val running = CodePushStartupCache()
            val selected = running.select(false) { frozen.baseline }
            check(state(root)["schemaVersion"] == 1L, "Waiting preflight created an attempt")
            release.countDown()
            check(completed.await(3, TimeUnit.SECONDS), "Downloader was incorrectly cancelled at the launch-screen deadline")
            check(File(runtimeRoot(root), "candidate.json").isFile && state(root)["pending"] == null, "Late downloader did not prepare only a candidate")
            check(gate.peek() === frozen && running.peek() === selected && selected.source == CodePushVersionSource.CURRENT, "Late download switched running JS")
            check(gate.prepare({ null }) { throw AssertionError("Warm opening retried download") } === frozen, "Warm opening changed preflight")
            check(store(root, nextProcess).select(true).source == CodePushVersionSource.TRIAL, "Next cold opening could not use the late candidate")
        }
        for (point in listOf("lifecycle_before_commit", "lifecycle_committed")) withRoot(parent) { root ->
            val old = baseline(root)
            val target = candidate(root); pointer(root, target)
            val active = AtomicBoolean(true)
            val selected = store(root, active = { active.get() }, fault = {
                if (it == point) active.set(false)
            }).select(true)
            check(selected.source == CodePushVersionSource.CURRENT && selected.packageId.endsWith(old.sha), "Cancelled selection returned trial JS")
            val after = state(root)
            check(after["pending"] == null, "Cancelled unissued selection kept pending")
            check((after["quarantined"] as? List<*>)?.isEmpty() != false && after["lastEvent"] == null, "Cancelled unissued selection poisoned the candidate")
        }
        withRoot(parent) { root ->
            val old = baseline(root)
            val target = candidate(root); pointer(root, target)
            var ticks = 0L
            val selected = store(root, fault = {
                if (it == "lifecycle_committed") ticks = 1_600_000_000L
            }, monotonic = { ticks }).select(true)
            check(selected.source == CodePushVersionSource.CURRENT && selected.packageId.endsWith(old.sha) && selected.reason == "startup_timeout", "Local selector deadline returned late trial")
            check(state(root)["pending"] == null && (state(root)["quarantined"] as List<*>).isEmpty() && state(root)["lastEvent"] == null,
                "Local timeout after durable commit left an unissued attempt")
            check(store(root, nextProcess).select(true).source == CodePushVersionSource.TRIAL, "Local timeout quarantined unexecuted candidate")
        }
        withRoot(parent) { root ->
            val old = baseline(root)
            val target = candidate(root); pointer(root, target)
            val baseline = store(root).select(false)
            val offered = CountDownLatch(1)
            val release = CountDownLatch(1)
            val cleaned = CountDownLatch(1)
            val cache = CodePushStartupCache(200)
            val chosen = cache.selectWithFallback(false, { baseline }, { trial ->
                store(root).rejectUnlaunchedTrial(trial)
                cleaned.countDown()
            }) {
                val trial = store(root).select(true)
                offered.countDown()
                while (true) { try { if (release.await(1, TimeUnit.SECONDS)) break } catch (_: InterruptedException) { } }
                trial
            }
            check(offered.count == 0L && chosen.source == CodePushVersionSource.CURRENT && chosen.packageId.endsWith(old.sha), "Outer local timeout lost its verified fallback")
            release.countDown()
            check(cleaned.await(2, TimeUnit.SECONDS), "Late offered trial was not rejected")
            check(cache.peek() === chosen && state(root)["pending"] == null, "Late offered trial changed the frozen fallback")
            check((state(root)["quarantined"] as List<*>).isEmpty(), "Rejected offered trial was quarantined")
        }
        withRoot(parent) { root ->
            baseline(root); val target = candidate(root); pointer(root, target)
            val s = store(root)
            val trial = s.select(true)
            store(root, nextProcess).rejectUnlaunchedTrial(trial)
            check(state(root)["pending"] != null, "Cross-process rejection cleared another attempt")
            s.rejectUnlaunchedTrial(trial.copy(attemptId = "f".repeat(32)))
            check(state(root)["pending"] != null, "Wrong attempt rejection cleared pending")
            check(s.confirmLaunch(trial, trial.attemptId).status == "confirmed", "Rejection guard prevented normal confirmation")
            val after = catalog(root).readBytes()
            s.rejectUnlaunchedTrial(trial)
            check(catalog(root).readBytes().contentEquals(after), "Rejection removed an accepted confirmed version")
        }
    }

    private fun baseline(root: File): Ref {
        val old = candidate(root, "global.baseline = true;\n".toByteArray(), 1)
        writeV1(root, old); return old
    }
    private fun payload(bytes: ByteArray, seq: Int): String {
        val original = CodePushJson.parse(base.toByteArray()) as Map<*, *>
        val pack = original["package"] as Map<*, *>
        return base.replace(pack["sha256"] as String, hash(bytes)).replace("\"size\":${pack["size"]}", "\"size\":${bytes.size}")
            .replace("\"manifestSequence\":1", "\"manifestSequence\":$seq").replace("\"version\":\"1.0.1\"", "\"version\":\"1.0.$seq\"")
    }
    private fun candidate(root: File, bytes: ByteArray = candidateBody, seq: Int = 2, source: String? = null): Ref {
        val text = source ?: payload(bytes, seq)
        val record = CodePushJson.parse(text.toByteArray()) as Map<*, *>
        val pack = record["package"] as Map<*, *>
        val sha = pack["sha256"] as String; val payloadHash = hash(text.toByteArray())
        val directory = File(runtimeRoot(root), "candidates/$sha-$payloadHash").apply { mkdirs() }
        File(directory, "index.android.bundle").writeBytes(bytes)
        File(directory, "manifest.json").writeBytes(signed(text))
        File(directory, "metadata.json").writeText("{\"manifestSequence\":${record["manifestSequence"]},\"nativeRuntimeId\":\"${runtime.nativeRuntimeId}\",\"packageSha256\":\"$sha\",\"payloadSha256\":\"$payloadHash\",\"size\":${pack["size"]},\"version\":\"${record["version"]}\"}\n")
        return Ref(sha, payloadHash, directory, text)
    }
    private fun pointer(root: File, ref: Ref) {
        File(runtimeRoot(root), "candidate.json").writeText(json(refObject(ref)))
        val record = CodePushJson.parse(ref.source.toByteArray()) as Map<*, *>
        File(runtimeRoot(root), "watermark.json").writeText("{\"manifestSequence\":${record["manifestSequence"]},\"payloadSha256\":\"${ref.payload}\"}")
        File(root, "install-id.json").writeText("{\"installId\":\"${"0".repeat(32)}\"}")
    }
    private fun signed(text: String): ByteArray {
        val bytes = text.toByteArray()
        val signature = Signature.getInstance("SHA256withECDSA").apply { initSign(pair.private); update("jaco-driver-codepush-manifest-v1\n".toByteArray()); update(bytes) }.sign()
        return "{\"keyId\":\"download-test-key\",\"payloadBase64\":\"${encode(bytes)}\",\"signatureBase64\":\"${encode(signature)}\"}".toByteArray()
    }
    private fun refObject(ref: Ref) = mapOf("packageSha256" to ref.sha, "payloadSha256" to ref.payload)
    private fun writeV1(root: File, current: Ref?, previous: Ref? = null) = writeState(root,
        mapOf("schemaVersion" to 1L, "nativeRuntimeId" to runtime.nativeRuntimeId, "current" to current?.let { refObject(it) }, "previous" to previous?.let { refObject(it) }))
    private fun state(root: File) = CodePushJson.parse(catalog(root).readBytes()) as Map<*, *>
    private fun writeState(root: File, value: Map<*, *>) { catalog(root).also { it.parentFile.mkdirs(); it.writeText(json(value)) } }
    private fun json(value: Any?): String = when (value) {
        null -> "null"
        is String -> "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""
        is Map<*, *> -> value.entries.joinToString(",", "{", "}") { json(it.key) + ":" + json(it.value) }
        is List<*> -> value.joinToString(",", "[", "]") { json(it) }
        else -> value.toString()
    }
    private fun catalog(root: File) = File(runtimeRoot(root), "versions.json")
    private fun runtimeRoot(root: File) = File(root, "v1/${runtime.nativeRuntimeId}")
    private fun encode(value: ByteArray) = Base64.getEncoder().encodeToString(value)
    private fun decode(value: String) = Base64.getDecoder().decode(value)
    private fun hash(value: ByteArray) = MessageDigest.getInstance("SHA-256").digest(value).joinToString("") { "%02x".format(it.toInt() and 255) }
    private fun check(value: Boolean, message: String) { checks++; if (!value) throw AssertionError(message) }
    private fun withRoot(parent: File, action: (File) -> Unit) {
        val container = Files.createTempDirectory(parent.toPath(), "android-lifecycle-").toFile()
        try { action(File(container, "codepush")) } finally {
            Files.walk(container.toPath()).use { it.sorted(Comparator.reverseOrder()).forEach { path -> Files.deleteIfExists(path) } }
        }
    }
}
