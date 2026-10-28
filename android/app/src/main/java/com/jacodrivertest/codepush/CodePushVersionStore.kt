package com.jacodrivertest.codepush

import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.ByteBuffer
import java.nio.channels.FileChannel
import java.nio.channels.OverlappingFileLockException
import java.nio.file.Files
import java.nio.file.LinkOption.NOFOLLOW_LINKS
import java.nio.file.StandardCopyOption.ATOMIC_MOVE
import java.nio.file.StandardCopyOption.REPLACE_EXISTING
import java.nio.file.StandardOpenOption.CREATE_NEW
import java.nio.file.StandardOpenOption.READ
import java.nio.file.StandardOpenOption.WRITE
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

enum class CodePushVersionSource { EMBEDDED, CURRENT, PREVIOUS, TRIAL }

data class CodePushVersionSelection(
    val source: CodePushVersionSource,
    val bundlePath: String? = null,
    val packageId: String = "",
    val version: String = "",
    val reason: String,
    val payloadSha256: String = "",
    val attemptId: String = "",
    val nativeRuntimeId: String = "",
    val processToken: String = "",
)

/** Only transient selection failures may use the already verified preflight baseline. */
fun CodePushVersionSelection.withVerifiedStartupFallback(verified: CodePushVersionSelection?): CodePushVersionSelection {
    if (source != CodePushVersionSource.EMBEDDED || reason !in setOf("startup_timeout", "lock_busy") ||
        verified == null || verified.source !in setOf(CodePushVersionSource.CURRENT, CodePushVersionSource.PREVIOUS) ||
        verified.attemptId.isNotEmpty()) return this
    return verified.copy(reason = reason, processToken = "")
}

data class CodePushLaunchResult(
    val status: String,
    val errorCode: String = "",
    val packageId: String = "",
    val version: String = "",
    val nativeRuntimeId: String = "",
    val attemptId: String = "",
    val source: String = "",
)

data class CodePushStorageDiagnostics(
    val storageStatus: String,
    val errorCode: String = "",
    val currentPackageId: String = "",
    val currentVersion: String = "",
    val previousPackageId: String = "",
    val previousVersion: String = "",
    val candidatePackageId: String = "",
    val candidateVersion: String = "",
    val candidateStatus: String = "none",
    val lastEvent: String = "",
    val lastEventPackageSha256: String = "",
)

/** Process-only observations; reading never starts or retries an operation. */
class CodePushDownloadActivity {
    private var latest = CodePushDownloadResult("not_checked")
    @Synchronized fun started() { latest = CodePushDownloadResult("checking") }
    @Synchronized fun completed(result: CodePushDownloadResult) { latest = result }
    @Synchronized fun snapshot(): CodePushDownloadResult = latest
}

/** The startup preflight and the bridge expose the same process-local observation. */
object CodePushDownloadObservations {
    val activity = CodePushDownloadActivity()
}

/** Only the first native opening intent establishes eligibility; headless work cannot enable it. */
class CodePushLaunchProvenance {
    private val signal = AtomicInteger(0)
    fun record(ordinaryLauncher: Boolean): Boolean = signal.compareAndSet(0, if (ordinaryLauncher) 1 else -1)
    fun allowsTrial(): Boolean = signal.get() == 1
    fun freezeEligibility(): Boolean {
        signal.compareAndSet(0, -1)
        return allowsTrial()
    }
}

/** Production Android supplies lstat/fstat checks; host fixtures use the JVM filesystem provider. */
interface CodePushVersionFileAccess {
    fun regular(file: File): Boolean
    fun openRead(file: File): FileChannel
}

private object CodePushJvmVersionFileAccess : CodePushVersionFileAccess {
    override fun regular(file: File): Boolean = try {
        Files.isRegularFile(file.toPath(), NOFOLLOW_LINKS) && !Files.isSymbolicLink(file.toPath()) &&
            (Files.getAttribute(file.toPath(), "unix:nlink", NOFOLLOW_LINKS) as? Number)?.toLong() == 1L
    } catch (_: Exception) { false }

    override fun openRead(file: File): FileChannel {
        cpRequire(regular(file), "storage_invalid")
        val channel = FileChannel.open(file.toPath(), READ, NOFOLLOW_LINKS)
        try { cpRequire(regular(file), "storage_invalid"); return channel }
        catch (failure: Exception) { channel.close(); throw failure }
    }
}

/** Process-local choice is immutable; importing or constructing it performs no I/O. */
class CodePushStartupCache(private val waitMillis: Long = 2000) {
    private var cached: CodePushVersionSelection? = null
    private val selecting = AtomicBoolean(false)

    @Synchronized fun peek(): CodePushVersionSelection? = cached
    fun selectionIsActive(): Boolean = selecting.get()

    fun select(debug: Boolean, factory: () -> CodePushVersionSelection): CodePushVersionSelection =
        selectWithFallback(debug, { null }, {}, factory)

    @Synchronized
    fun selectWithFallback(debug: Boolean, fallback: () -> CodePushVersionSelection?,
        onRejected: (CodePushVersionSelection) -> Unit,
        factory: () -> CodePushVersionSelection): CodePushVersionSelection {
        if (debug) return CodePushVersionSelection(CodePushVersionSource.EMBEDDED, reason = "debug_metro")
        cached?.let { return it }
        if (waitMillis !in 1..10000) return CodePushVersionSelection(CodePushVersionSource.EMBEDDED,
            reason = "startup_timeout").also { cached = it }
        val started = System.nanoTime()
        data class Completion(val value: CodePushVersionSelection, val at: Long)
        val gate = Any()
        var offered: Completion? = null
        var closed = false
        var accepted = false
        var rejectionScheduled = false
        fun rejectIfNeeded() {
            val rejected = synchronized(gate) {
                val value = offered?.value
                if (closed && !accepted && !rejectionScheduled && value?.source == CodePushVersionSource.TRIAL) {
                    rejectionScheduled = true
                    value
                } else null
            }
            if (rejected != null) Thread({
                try { onRejected(rejected) } catch (_: Exception) { }
            }, "CodePush-unissued-trial-cleanup").apply { isDaemon = true; start() }
        }
        selecting.set(true)
        val task = FutureTask {
            val value = factory()
            val completed = synchronized(gate) {
                Completion(value, System.nanoTime()).also { offered = it }
            }
            rejectIfNeeded()
            completed
        }
        Thread(task, "CodePush-startup-selection").apply { isDaemon = true; start() }
        var failure = "startup_timeout"
        var permitCompleted = true
        try { task.get((waitMillis * 1_000_000 - (System.nanoTime() - started)).coerceAtLeast(0), TimeUnit.NANOSECONDS) }
        catch (_: TimeoutException) {
        } catch (_: InterruptedException) {
            permitCompleted = false
            Thread.currentThread().interrupt()
        } catch (_: Exception) {
            failure = "selection_failed"
        }
        val chosen = synchronized(gate) {
            val completed = offered
            accepted = permitCompleted && completed != null &&
                completed.at - started in 0 until waitMillis * 1_000_000
            closed = true
            selecting.set(false)
            if (accepted) completed?.value else null
        }
        val result = chosen ?: run {
            task.cancel(true)
            val verified = try { fallback() } catch (_: Exception) { null }
            if (verified != null && verified.source != CodePushVersionSource.TRIAL && verified.attemptId.isEmpty())
                verified.copy(reason = failure, processToken = "")
            else CodePushVersionSelection(CodePushVersionSource.EMBEDDED, reason = failure)
        }
        cached = result
        rejectIfNeeded()
        return result
    }
}

data class CodePushPreflightResult(val baseline: CodePushVersionSelection, val allowTrial: Boolean)

/** Native-only preparation. No pending attempt exists while this asynchronous gate is waiting. */
class CodePushColdPreflight(
    private val monotonicNanos: () -> Long = System::nanoTime,
    private val selectionActive: () -> Boolean = { true },
) {
    fun prepare(ordinaryOpening: Boolean, selectBaseline: () -> CodePushVersionSelection,
        publishBaseline: (CodePushVersionSelection) -> Unit,
        download: () -> CodePushDownloadResult): CodePushPreflightResult {
        val started = monotonicNanos()
        fun remaining(): Long {
            val elapsed = monotonicNanos() - started
            if (!selectionActive() || Thread.currentThread().isInterrupted || elapsed < 0) return 0
            return (8000L - elapsed / 1_000_000).coerceAtLeast(0)
        }
        val baseline = selectBaseline()
        if (baseline.source != CodePushVersionSource.TRIAL && baseline.attemptId.isEmpty()) publishBaseline(baseline)
        if (!ordinaryOpening || baseline.reason in setOf("launch_unconfirmed", "recovery_write_failed", "lock_busy",
                "runtime_invalid", "catalog_invalid", "storage_invalid", "storage_error", "selection_failed", "startup_timeout"))
            return CodePushPreflightResult(baseline, false)
        if (remaining() <= 0) return CodePushPreflightResult(baseline.copy(reason = "startup_timeout"), false)
        // Startup waits only eight seconds. The bounded downloader may finish its candidate later.
        val downloaded = download()
        if (remaining() <= 0 || downloaded.errorCode == "download_timeout")
            return CodePushPreflightResult(baseline.copy(reason = "startup_timeout"), false)
        val eligible = downloaded.status in setOf("downloaded", "already_downloaded", "error")
            && downloaded.errorCode != "runtime_invalid"
        return CodePushPreflightResult(baseline, eligible)
    }
}

/** Process-only preflight outcome; the worker can never replace a caller's frozen fallback. */
class CodePushPreflightCache(private val waitMillis: Long = 8000) {
    private val cached = AtomicReference<CodePushPreflightResult?>()
    private val active = AtomicBoolean(false)

    fun peek(): CodePushPreflightResult? = cached.get()
    fun preparationIsActive(): Boolean = active.get()

    fun freezeFallback(baseline: CodePushVersionSelection): CodePushPreflightResult {
        val safe = if (baseline.source != CodePushVersionSource.TRIAL && baseline.attemptId.isEmpty()) baseline
            else CodePushVersionSelection(CodePushVersionSource.EMBEDDED, reason = "startup_timeout")
        cached.compareAndSet(null, CodePushPreflightResult(safe.copy(reason = "startup_timeout", processToken = ""), false))
        active.set(false)
        return cached.get()!!
    }

    /** An external intent supersedes the waiting launcher without waiting for its network worker. */
    fun disallowTrial(baseline: CodePushVersionSelection): CodePushPreflightResult {
        active.set(false)
        val safe = if (baseline.source != CodePushVersionSource.TRIAL && baseline.attemptId.isEmpty()) baseline
            else CodePushVersionSelection(CodePushVersionSource.EMBEDDED, reason = "external_start")
        return cached.updateAndGet { previous ->
            if (previous == null) CodePushPreflightResult(safe.copy(reason = "external_start", processToken = ""), false)
            else previous.copy(allowTrial = false)
        }!!
    }

    @Synchronized
    fun prepare(fallback: () -> CodePushVersionSelection?, factory: () -> CodePushPreflightResult): CodePushPreflightResult {
        cached.get()?.let { return it }
        val started = System.nanoTime()
        val default = { fallback() ?: CodePushVersionSelection(CodePushVersionSource.EMBEDDED, reason = "startup_timeout") }
        if (waitMillis !in 1..8000) return freezeFallback(default())
        active.set(true)
        val work = FutureTask {
            val result = factory()
            val elapsed = System.nanoTime() - started
            if (active.get() && elapsed in 0 until waitMillis * 1_000_000) cached.compareAndSet(null, result)
            result
        }
        Thread(work, "CodePush-startup-preflight").apply { isDaemon = true; start() }
        try { work.get((waitMillis * 1_000_000 - (System.nanoTime() - started)).coerceAtLeast(0), TimeUnit.NANOSECONDS) }
        catch (_: InterruptedException) { Thread.currentThread().interrupt() }
        catch (_: Exception) { }
        cached.get()?.let { active.set(false); return it }
        return freezeFallback(default())
    }
}

/** Owns one atomic lifecycle record. Trial startup is opt-in and never reloads a working app. */
class CodePushVersionStore(
    private val privateRoot: File,
    private val runtime: CodePushRuntime,
    private val verifyEnvelope: (ByteArray) -> CodePushManifestVerifier.VerificationResult,
    private val fault: (String) -> Unit = {},
    private val monotonicNanos: () -> Long = System::nanoTime,
    private val fileAccess: CodePushVersionFileAccess = CodePushJvmVersionFileAccess,
    private val processToken: String = "",
    private val clock: () -> Long = System::currentTimeMillis,
    private val selectionActive: () -> Boolean = { true },
    private val onVerifiedBaseline: (CodePushVersionSelection) -> Unit = {},
) {
    private data class Ref(val packageSha256: String, val payloadSha256: String)
    private data class Pending(val attemptId: String, val processToken: String, val candidate: Ref, val fallback: Ref?)
    private data class Event(val code: String, val attemptId: String, val packageSha256: String)
    private data class State(val schema: Int, val current: Ref?, val previous: Ref?,
        val pending: Pending? = null, val quarantined: List<String> = emptyList(),
        val activationBlocked: Boolean = false, val lastEvent: Event? = null)
    private data class Verified(val selection: CodePushVersionSelection, val manifest: CodePushManifest)
    private val running = AtomicBoolean(false)
    private var started = 0L
    private var budgetNanos = 1_500_000_000L
    private var cleaningUnissuedTrial = false

    fun select(allowTrial: Boolean = false): CodePushVersionSelection {
        if (!running.compareAndSet(false, true)) return embedded("lock_busy")
        return try {
            started = monotonicNanos()
            budgetNanos = 1_500_000_000L
            budget()
            locked { selectLocked(it, allowTrial) }
        } catch (failure: CodePushFailure) {
            embedded(failure.code)
        } catch (_: java.io.IOException) {
            embedded(if (Thread.currentThread().isInterrupted || monotonicNanos() - started >= 1_500_000_000L) "startup_timeout" else "storage_error")
        } catch (_: Exception) {
            embedded("selection_failed")
        } finally { running.set(false) }
    }

    /** Existing files only: no initialization, recovery, quarantine, acknowledgement or cleanup. */
    fun diagnostics(): CodePushStorageDiagnostics {
        if (!running.compareAndSet(false, true)) return CodePushStorageDiagnostics("busy", "lock_busy")
        return try {
            started = monotonicNanos()
            budgetNanos = 10_000_000_000L
            budget()
            cpRequire(runtime.platform == "android" && runtime.appId == "jaco-driver" &&
                CodePushManifestValidator.hashPattern.matches(runtime.nativeRuntimeId), "runtime_invalid")
            directory(privateRoot.parentFile ?: throw CodePushFailure("storage_invalid"), false)
            if (!Files.exists(privateRoot.toPath(), NOFOLLOW_LINKS)) return CodePushStorageDiagnostics("missing")
            directory(privateRoot, false)
            val lockFile = File(privateRoot, ".manager.lock")
            if (!Files.exists(lockFile.toPath(), NOFOLLOW_LINKS)) return CodePushStorageDiagnostics("missing")
            regular(lockFile)
            fileAccess.openRead(lockFile).use { channel ->
                val lock = try { channel.tryLock(0, Long.MAX_VALUE, true) } catch (_: OverlappingFileLockException) { null }
                if (lock == null) return CodePushStorageDiagnostics("busy", "lock_busy")
                lock.use {
                    val v1 = File(privateRoot, "v1")
                    if (!Files.exists(v1.toPath(), NOFOLLOW_LINKS)) return CodePushStorageDiagnostics("missing")
                    directory(v1, false)
                    val root = File(v1, runtime.nativeRuntimeId)
                    if (!Files.exists(root.toPath(), NOFOLLOW_LINKS)) return CodePushStorageDiagnostics("missing")
                    directory(root, false)
                    val catalog = File(root, "versions.json")
                    val state = if (Files.exists(catalog.toPath(), NOFOLLOW_LINKS)) readState(catalog) else null
                    val current = state?.current?.let { verifyVersion(root, it, CodePushVersionSource.CURRENT)?.selection }
                    val previous = state?.previous?.let { verifyVersion(root, it, CodePushVersionSource.PREVIOUS)?.selection }
                    var candidate: CodePushVersionSelection? = null
                    val pointer = File(root, "candidate.json")
                    var candidateStatus = "none"
                    if (Files.exists(pointer.toPath(), NOFOLLOW_LINKS)) {
                        candidateStatus = "invalid"
                        try {
                            val ref = reference(CodePushJson.parse(read(pointer, 4096))) ?: throw CodePushFailure("candidate_invalid")
                            candidate = verifyVersion(root, ref, CodePushVersionSource.TRIAL)?.selection
                            if (candidate != null) candidateStatus = "ready"
                        } catch (failure: CodePushFailure) { if (failure.code == "startup_timeout") throw failure }
                        catch (_: Exception) { budget() }
                    }
                    val invalid = (state?.current != null && current == null) || (state?.previous != null && previous == null)
                    budget()
                    CodePushStorageDiagnostics(if (invalid) "invalid" else if (state == null) "missing" else "ready",
                        errorCode = if (invalid) "stored_version_invalid" else "",
                        currentPackageId = current?.packageId ?: "", currentVersion = current?.version ?: "",
                        previousPackageId = previous?.packageId ?: "", previousVersion = previous?.version ?: "",
                        candidatePackageId = candidate?.packageId ?: "", candidateVersion = candidate?.version ?: "",
                        candidateStatus = candidateStatus, lastEvent = state?.lastEvent?.code ?: "",
                        lastEventPackageSha256 = state?.lastEvent?.packageSha256 ?: "")
                }
            }
        } catch (failure: CodePushFailure) {
            CodePushStorageDiagnostics("invalid", if (failure.code == "startup_timeout") "diagnostics_timeout" else
                if (failure.code == "catalog_invalid" || failure.code == "runtime_mismatch") "state_invalid" else failure.code)
        } catch (_: Exception) { CodePushStorageDiagnostics("invalid", "diagnostics_failed") }
        finally { running.set(false) }
    }

    private fun <T> locked(action: (File) -> T): T {
        cpRequire(runtime.appId == "jaco-driver" && runtime.platform == "android" &&
            CodePushManifestValidator.hashPattern.matches(runtime.nativeRuntimeId) &&
            Regex("[1-9][0-9]{0,18}").matches(runtime.nativeBuild), "runtime_invalid")
        directory(privateRoot.parentFile ?: throw CodePushFailure("storage_invalid"), false)
        directory(privateRoot, true)
        val lockPath = File(privateRoot, ".manager.lock").toPath()
        try { Files.createFile(lockPath) } catch (_: java.nio.file.FileAlreadyExistsException) { }
        regular(lockPath.toFile())
        return FileChannel.open(lockPath, WRITE, NOFOLLOW_LINKS).use { channel ->
            budget()
            val lock = try { channel.tryLock() } catch (_: OverlappingFileLockException) { null }
            cpRequire(lock != null, "lock_busy")
            lock!!.use {
                val v1 = File(privateRoot, "v1").also { directory(it, true) }
                val root = File(v1, runtime.nativeRuntimeId).also { directory(it, true) }
                action(root)
            }
        }
    }

    private fun selectLocked(runtimeRoot: File, allowTrial: Boolean): CodePushVersionSelection {
        val catalog = File(runtimeRoot, "versions.json")
        var initialized = false
        if (!Files.exists(catalog.toPath(), NOFOLLOW_LINKS)) {
            initializeCatalog(catalog)
            initialized = true
        }
        val state = readState(catalog)
        val baseline = state.current?.let { verifyVersion(runtimeRoot, it, CodePushVersionSource.CURRENT)?.selection }
            ?: state.previous?.let { verifyVersion(runtimeRoot, it, CodePushVersionSource.PREVIOUS)?.selection }
            ?: embedded(if (initialized) "catalog_initialized" else if (state.current == null && state.previous == null) "embedded" else "versions_unavailable")
        budget()
        onVerifiedBaseline(baseline)
        val pending = state.pending
        if (pending != null) {
            val hashes = state.quarantined.toMutableList()
            var blocked = state.activationBlocked
            if (pending.candidate.packageSha256 !in hashes) {
                if (hashes.size == 64) blocked = true else hashes.add(pending.candidate.packageSha256)
            }
            try {
                writeState(catalog, state.copy(schema = 2, pending = null, quarantined = hashes,
                    activationBlocked = blocked, lastEvent = Event("launch_unconfirmed", pending.attemptId, pending.candidate.packageSha256)))
            } catch (failure: Exception) {
                budget()
                return baseline.copy(reason = "recovery_write_failed")
            }
            return baseline.copy(reason = "launch_unconfirmed")
        }
        if (!allowTrial || state.activationBlocked) return baseline
        cpRequire(Regex("[a-f0-9]{32}").matches(processToken), "runtime_invalid")
        return tryTrial(runtimeRoot, catalog, state, baseline)
    }

    private fun readState(catalog: File): State {
        return try {
            val parsed = CodePushJson.parse(read(catalog, 8192)) as? Map<*, *> ?: throw CodePushFailure("catalog_invalid")
            val schema = parsed["schemaVersion"]
            cpRequire(schema == 1L || schema == 2L, "catalog_invalid")
            val keys = if (schema == 1L) setOf("schemaVersion", "nativeRuntimeId", "current", "previous") else
                setOf("schemaVersion", "nativeRuntimeId", "current", "previous", "pending", "quarantined", "activationBlocked", "lastEvent")
            val data = CodePushManifestValidator.record(parsed, keys)
            cpRequire(data["nativeRuntimeId"] == runtime.nativeRuntimeId, "runtime_mismatch")
            val current = reference(data["current"])
            val previous = reference(data["previous"])
            cpRequire(!(current == null && previous != null) && !(current != null && current == previous), "catalog_invalid")
            if (schema == 1L) State(1, current, previous) else {
                val p = data["pending"]?.let {
                    val value = CodePushManifestValidator.record(it, setOf("attemptId", "processToken", "candidate", "fallback"))
                    Pending(id(value["attemptId"]), id(value["processToken"]), reference(value["candidate"]) ?: throw CodePushFailure("catalog_invalid"), reference(value["fallback"]))
                }
                if (p != null) {
                    cpRequire(p.candidate.packageSha256 != current?.packageSha256 &&
                        p.candidate.packageSha256 != previous?.packageSha256 &&
                        (p.fallback == null || p.fallback == current || p.fallback == previous), "catalog_invalid")
                }
                val q = data["quarantined"] as? List<*> ?: throw CodePushFailure("catalog_invalid")
                cpRequire(q.size <= 64, "catalog_invalid")
                val hashes = q.map { CodePushManifestValidator.text(it, CodePushManifestValidator.hashPattern) }
                cpRequire(hashes.toSet().size == hashes.size, "catalog_invalid")
                val blocked = data["activationBlocked"] as? Boolean ?: throw CodePushFailure("catalog_invalid")
                val event = data["lastEvent"]?.let {
                    val value = CodePushManifestValidator.record(it, setOf("code", "attemptId", "packageSha256"))
                    val code = value["code"] as? String ?: throw CodePushFailure("catalog_invalid")
                        cpRequire(code == "confirmed" || code == "launch_unconfirmed" || code == "fatal_after_confirmation", "catalog_invalid")
                    Event(code, id(value["attemptId"]), CodePushManifestValidator.text(value["packageSha256"], CodePushManifestValidator.hashPattern))
                }
                State(2, current, previous, p, hashes, blocked, event)
            }
        } catch (failure: CodePushFailure) {
            if (failure.code == "runtime_mismatch" || failure.code == "startup_timeout") throw failure
            throw CodePushFailure("catalog_invalid")
        }
    }

    private fun reference(value: Any?): Ref? {
        if (value == null) return null
        val data = CodePushManifestValidator.record(value, setOf("packageSha256", "payloadSha256"))
        return Ref(CodePushManifestValidator.text(data["packageSha256"], CodePushManifestValidator.hashPattern),
            CodePushManifestValidator.text(data["payloadSha256"], CodePushManifestValidator.hashPattern))
    }

    private fun id(value: Any?): String = CodePushManifestValidator.text(value, Regex("[a-f0-9]{32}"))

    private fun tryTrial(root: File, catalog: File, state: State, baseline: CodePushVersionSelection): CodePushVersionSelection {
        var unissued: Pending? = null
        return try {
            val pointer = File(root, "candidate.json")
            if (!Files.exists(pointer.toPath(), NOFOLLOW_LINKS)) return baseline
            val target = reference(CodePushJson.parse(read(pointer, 4096))) ?: return baseline
            if (target.packageSha256 in state.quarantined || target.packageSha256 == state.current?.packageSha256 ||
                target.packageSha256 == state.previous?.packageSha256) return baseline
            val latest = CodePushManifestValidator.record(CodePushJson.parse(read(File(root, "watermark.json"), 4096)),
                setOf("manifestSequence", "payloadSha256"))
            val sequence = CodePushManifestValidator.integer(latest["manifestSequence"], 1, CodePushJson.MAX_SAFE_INTEGER)
            cpRequire(latest["payloadSha256"] == target.payloadSha256, "candidate_controls_invalid")
            val install = CodePushManifestValidator.record(CodePushJson.parse(read(File(privateRoot, "install-id.json"), 1024)), setOf("installId"))
            val installId = id(install["installId"])
            val verified = verifyVersion(root, target, CodePushVersionSource.TRIAL, admission = true)
                ?: return baseline.copy(reason = "candidate_unavailable")
            val m = verified.manifest
            if (!m.enabled || m.sequence != sequence || !selected(installId, m)) return baseline
            val fallback = if (baseline.source == CodePushVersionSource.CURRENT || baseline.source == CodePushVersionSource.PREVIOUS)
                Ref(baseline.packageId.substringAfter(':'), baseline.payloadSha256) else null
            val pending = Pending(UUID.randomUUID().toString().replace("-", ""), processToken, target, fallback)
            unissued = pending
            writeState(catalog, state.copy(schema = 2, pending = pending))
            budget()
            verified.selection.copy(attemptId = pending.attemptId, processToken = processToken)
        } catch (failure: CodePushFailure) {
            unissued?.let { clearUnissuedPending(catalog, it) }
            baseline.copy(reason = failure.code)
        } catch (_: Exception) {
            unissued?.let { clearUnissuedPending(catalog, it) }
            baseline.copy(reason = "candidate_unavailable")
        }
    }

    /** Called only for a cache-rejected offer; a confirmed attempt never matches its pending record. */
    fun rejectUnlaunchedTrial(binding: CodePushVersionSelection) {
        if (binding.source != CodePushVersionSource.TRIAL || binding.nativeRuntimeId != runtime.nativeRuntimeId ||
            binding.processToken != processToken || !Regex("[a-f0-9]{32}").matches(binding.attemptId) ||
            !running.compareAndSet(false, true)) return
        val interrupted = Thread.interrupted()
        try {
            cleaningUnissuedTrial = true
            started = monotonicNanos()
            budgetNanos = 1_500_000_000L
            locked { root ->
                val catalog = File(root, "versions.json")
                val state = readState(catalog)
                val pending = state.pending
                if (pending != null && pending.attemptId == binding.attemptId &&
                    pending.processToken == binding.processToken &&
                    binding.packageId == runtime.nativeRuntimeId + ":" + pending.candidate.packageSha256 &&
                    pending.candidate.payloadSha256 == binding.payloadSha256) {
                    clearUnissuedPending(catalog, pending)
                }
            }
        } catch (_: Exception) {
            // A failed cleanup stays conservative: the next process can recover the unconfirmed attempt.
        } finally {
            cleaningUnissuedTrial = false
            running.set(false)
            if (interrupted) Thread.currentThread().interrupt()
        }
    }

    private fun clearUnissuedPending(catalog: File, expected: Pending) {
        val oldStarted = started
        val oldBudget = budgetNanos
        val oldCleaning = cleaningUnissuedTrial
        val interrupted = Thread.interrupted()
        try {
            cleaningUnissuedTrial = true
            started = monotonicNanos()
            budgetNanos = 1_500_000_000L
            val actual = readState(catalog)
            if (actual.pending == expected && expected.processToken == processToken) {
                // Keep current/previous, quarantine and events exactly as read under the OS lock.
                writeState(catalog, actual.copy(pending = null))
            }
        } catch (_: Exception) { }
        finally {
            started = oldStarted
            budgetNanos = oldBudget
            cleaningUnissuedTrial = oldCleaning
            if (interrupted) Thread.currentThread().interrupt()
        }
    }

    /** Binding is created by native for the executing runtime, never constructed from JS arguments. */
    fun confirmLaunch(binding: CodePushVersionSelection, requestedAttemptId: String,
        bindingValid: () -> Boolean = { true }): CodePushLaunchResult {
        if (!running.compareAndSet(false, true)) return launchFailure("lock_busy")
        return try {
            started = monotonicNanos()
            budgetNanos = 1_500_000_000L
            budget()
            cpRequire(bindingValid() && binding.source == CodePushVersionSource.TRIAL && binding.bundlePath != null &&
                binding.nativeRuntimeId == runtime.nativeRuntimeId && binding.attemptId == requestedAttemptId &&
                binding.processToken == processToken &&
                Regex("[a-f0-9]{32}").matches(requestedAttemptId) && Regex("[a-f0-9]{32}").matches(processToken), "confirmation_invalid")
            val targetHash = binding.packageId.removePrefix("${runtime.nativeRuntimeId}:")
            cpRequire(binding.packageId == "${runtime.nativeRuntimeId}:$targetHash" &&
                CodePushManifestValidator.hashPattern.matches(targetHash) && CodePushManifestValidator.hashPattern.matches(binding.payloadSha256), "confirmation_invalid")
            val target = Ref(targetHash, binding.payloadSha256)
            locked { root ->
                val file = File(root, "versions.json")
                val state = readState(file)
                cpRequire(!state.activationBlocked && targetHash !in state.quarantined, "activation_blocked")
                val pending = state.pending
                if (pending == null) {
                    cpRequire(state.lastEvent == Event("confirmed", requestedAttemptId, targetHash) && state.current == target,
                        "confirmation_invalid")
                } else {
                    cpRequire(pending.attemptId == requestedAttemptId && pending.processToken == processToken && pending.candidate == target,
                        "confirmation_invalid")
                    val verified = verifyVersion(root, target, CodePushVersionSource.TRIAL)
                        ?: throw CodePushFailure("confirmation_invalid")
                    cpRequire(verified.selection.bundlePath == binding.bundlePath && verified.selection.version == binding.version,
                        "confirmation_invalid")
                    writeState(file, state.copy(schema = 2, current = target, previous = pending.fallback, pending = null,
                        lastEvent = Event("confirmed", requestedAttemptId, targetHash)),
                        beforeCommit = { cpRequire(bindingValid(), "confirmation_invalid") })
                }
                cpRequire(bindingValid(), "confirmation_invalid")
                CodePushLaunchResult("confirmed", packageId = binding.packageId, version = binding.version,
                    nativeRuntimeId = runtime.nativeRuntimeId, attemptId = binding.attemptId, source = "trial")
            }
        } catch (failure: CodePushFailure) { launchFailure(if (failure.code == "catalog_invalid") "state_invalid" else failure.code) }
        catch (_: Exception) { launchFailure("confirmation_failed") }
        finally { running.set(false) }
    }

    /** Record only the confirmed package bound to this process; ordinary process termination is not an error. */
    fun markFatal(binding: CodePushVersionSelection, bindingValid: () -> Boolean = { true }): Boolean {
        if (!running.compareAndSet(false, true)) return false
        return try {
            started = monotonicNanos()
            budgetNanos = 1_500_000_000L
            cpRequire(bindingValid() && binding.source in setOf(CodePushVersionSource.CURRENT, CodePushVersionSource.PREVIOUS, CodePushVersionSource.TRIAL) &&
                binding.nativeRuntimeId == runtime.nativeRuntimeId, "fatal_binding_invalid")
            val hash = binding.packageId.removePrefix("${runtime.nativeRuntimeId}:")
            cpRequire(binding.packageId == "${runtime.nativeRuntimeId}:$hash" &&
                CodePushManifestValidator.hashPattern.matches(hash) &&
                CodePushManifestValidator.hashPattern.matches(binding.payloadSha256), "fatal_binding_invalid")
            val target = Ref(hash, binding.payloadSha256)
            locked { root ->
                val file = File(root, "versions.json")
                val state = readState(file)
                val runningPrevious = binding.source == CodePushVersionSource.PREVIOUS
                cpRequire(state.pending == null && (if (runningPrevious) state.previous == target else state.current == target), "fatal_binding_invalid")
                if (runningPrevious) cpRequire(state.current == null ||
                    verifyVersion(root, state.current, CodePushVersionSource.CURRENT) == null, "fatal_binding_invalid")
                val current = verifyVersion(root, target, if (runningPrevious) CodePushVersionSource.PREVIOUS else CodePushVersionSource.CURRENT)
                    ?: throw CodePushFailure("fatal_binding_invalid")
                cpRequire(current.selection.bundlePath == binding.bundlePath && current.selection.version == binding.version, "fatal_binding_invalid")
                val previous = if (runningPrevious) null else state.previous?.takeIf {
                    it.packageSha256 !in state.quarantined && verifyVersion(root, it, CodePushVersionSource.PREVIOUS) != null
                }
                val hashes = state.quarantined.toMutableList()
                var blocked = state.activationBlocked
                if (hash !in hashes) {
                    if (hashes.size == 64) blocked = true else hashes.add(hash)
                }
                // Never re-admit the failing current version, even when quarantine is full.
                writeState(file, state.copy(schema = 2, current = previous, previous = null,
                    quarantined = hashes, activationBlocked = blocked,
                    lastEvent = Event("fatal_after_confirmation", UUID.randomUUID().toString().replace("-", ""), hash)),
                    beforeCommit = { cpRequire(bindingValid(), "fatal_binding_invalid") })
                true
            }
        } catch (_: Exception) { false }
        finally { running.set(false) }
    }

    private fun launchFailure(code: String) = CodePushLaunchResult("error", code, nativeRuntimeId = runtime.nativeRuntimeId)

    private fun selected(installId: String, manifest: CodePushManifest): Boolean {
        val bytes = MessageDigest.getInstance("SHA-256").digest(
            "jaco-driver-codepush-rollout-v1\n$installId\n${runtime.appId}\n${manifest.rolloutSeed}".toByteArray())
        val number = ((bytes[0].toLong() and 255) shl 24) or ((bytes[1].toLong() and 255) shl 16) or
            ((bytes[2].toLong() and 255) shl 8) or (bytes[3].toLong() and 255)
        return number % 10000 < manifest.rolloutBasisPoints
    }

    private fun writeState(file: File, state: State, beforeCommit: () -> Unit = {}) {
        budget()
        regular(file)
        fun ref(value: Ref?) = if (value == null) "null" else
            "{\"packageSha256\":\"${value.packageSha256}\",\"payloadSha256\":\"${value.payloadSha256}\"}"
        val pending = state.pending?.let {
            "{\"attemptId\":\"${it.attemptId}\",\"processToken\":\"${it.processToken}\",\"candidate\":${ref(it.candidate)},\"fallback\":${ref(it.fallback)}}"
        } ?: "null"
        val event = state.lastEvent?.let {
            "{\"code\":\"${it.code}\",\"attemptId\":\"${it.attemptId}\",\"packageSha256\":\"${it.packageSha256}\"}"
        } ?: "null"
        val quarantine = state.quarantined.joinToString(",") { "\"$it\"" }
        val bytes = "{\"schemaVersion\":2,\"nativeRuntimeId\":\"${runtime.nativeRuntimeId}\",\"current\":${ref(state.current)},\"previous\":${ref(state.previous)},\"pending\":$pending,\"quarantined\":[$quarantine],\"activationBlocked\":${state.activationBlocked},\"lastEvent\":$event}\n".toByteArray()
        val parent = file.parentFile ?: throw CodePushFailure("storage_invalid")
        val temporary = File(parent, ".versions.json-${UUID.randomUUID()}.tmp")
        var owned = false
        try {
            FileChannel.open(temporary.toPath(), CREATE_NEW, WRITE, NOFOLLOW_LINKS).use { channel ->
                owned = true
                val buffer = ByteBuffer.wrap(bytes)
                while (buffer.hasRemaining()) { budget(); channel.write(buffer) }
                channel.force(true)
            }
            fault("lifecycle_before_commit")
            budget()
            beforeCommit()
            regular(file)
            Files.move(temporary.toPath(), file.toPath(), ATOMIC_MOVE, REPLACE_EXISTING)
            owned = false
            FileChannel.open(parent.toPath(), READ).use { it.force(true) }
            fault("lifecycle_committed")
            budget()
        } finally { if (owned) Files.deleteIfExists(temporary.toPath()) }
    }

    private fun verifyVersion(root: File, ref: Ref, source: CodePushVersionSource, admission: Boolean = false): Verified? {
        return try {
            budget()
            val candidates = File(root, "candidates").also { directory(it, false) }
            val candidate = File(candidates, "${ref.packageSha256}-${ref.payloadSha256}").also { directory(it, false) }
            val contents = mutableSetOf<String>()
            Files.newDirectoryStream(candidate.toPath()).use { entries ->
                for (entry in entries) {
                    budget()
                    cpRequire(contents.size < 3, "candidate_invalid")
                    contents.add(entry.fileName.toString())
                }
            }
            cpRequire(contents == setOf("index.android.bundle", "manifest.json", "metadata.json"), "candidate_invalid")
            val verified = verifyEnvelope(read(File(candidate, "manifest.json"), 704 * 1024))
            budget()
            cpRequire(verified.isVerified, "signature_invalid")
            val payload = verified.payloadBytes ?: throw CodePushFailure("signature_invalid")
            cpRequire(hash(payload) == ref.payloadSha256, "candidate_invalid")
            val manifest = if (admission) CodePushManifestValidator.validate(payload, runtime, clock()) else
                CodePushManifestValidator.validateStoredCompatible(payload, runtime)
            cpRequire(manifest.sha256 == ref.packageSha256, "candidate_invalid")
            val metadata = CodePushManifestValidator.record(CodePushJson.parse(read(File(candidate, "metadata.json"), 8192)),
                setOf("manifestSequence", "nativeRuntimeId", "packageSha256", "payloadSha256", "size", "version"))
            cpRequire(metadata["manifestSequence"] == manifest.sequence && metadata["nativeRuntimeId"] == runtime.nativeRuntimeId &&
                metadata["packageSha256"] == ref.packageSha256 && metadata["payloadSha256"] == ref.payloadSha256 &&
                metadata["size"] == manifest.size && metadata["version"] == manifest.version, "candidate_invalid")
            val bundle = File(candidate, manifest.entrypoint)
            regular(bundle)
            fileAccess.openRead(bundle).use { input ->
                budget()
                cpRequire(input.size() == manifest.size, "size_mismatch")
                val digest = MessageDigest.getInstance("SHA-256")
                val buffer = ByteBuffer.allocate(64 * 1024)
                var count = 0L
                while (true) {
                    budget()
                    val read = input.read(buffer)
                    budget()
                    if (read == -1) break
                    count += read
                    cpRequire(count <= manifest.size, "size_mismatch")
                    buffer.flip(); digest.update(buffer); buffer.clear()
                }
                cpRequire(count == manifest.size && hex(digest.digest()) == ref.packageSha256, "hash_mismatch")
            }
            budget()
            Verified(CodePushVersionSelection(source, bundle.absolutePath, manifest.packageId, manifest.version,
                if (source == CodePushVersionSource.CURRENT) "current_valid" else if (source == CodePushVersionSource.PREVIOUS) "previous_valid" else "trial",
                payloadSha256 = ref.payloadSha256, nativeRuntimeId = runtime.nativeRuntimeId), manifest)
        } catch (failure: CodePushFailure) {
            if (failure.code == "startup_timeout") throw failure
            null
        } catch (_: Exception) { budget(); null }
    }

    private fun initializeCatalog(file: File) {
        budget()
        val parent = file.parentFile ?: throw CodePushFailure("storage_invalid")
        val temporary = File(parent, ".versions.json-${UUID.randomUUID()}.tmp")
        var owned = false
        try {
            val bytes = "{\"schemaVersion\":1,\"nativeRuntimeId\":\"${runtime.nativeRuntimeId}\",\"current\":null,\"previous\":null}\n".toByteArray()
            FileChannel.open(temporary.toPath(), CREATE_NEW, WRITE, NOFOLLOW_LINKS).use { channel ->
                owned = true
                val buffer = ByteBuffer.wrap(bytes)
                while (buffer.hasRemaining()) channel.write(buffer)
                channel.force(true)
                budget()
            }
            fault("versions_before_commit")
            budget()
            cpRequire(!Files.exists(file.toPath(), NOFOLLOW_LINKS), "catalog_invalid")
            Files.move(temporary.toPath(), file.toPath(), ATOMIC_MOVE)
            owned = false
            FileChannel.open(parent.toPath(), READ).use { it.force(true) }
            budget()
            fault("versions_initialized")
        } finally { if (owned) Files.deleteIfExists(temporary.toPath()) }
    }

    private fun directory(file: File, create: Boolean) {
        budget()
        if (create && !Files.exists(file.toPath(), NOFOLLOW_LINKS)) {
            try { Files.createDirectory(file.toPath()) } catch (_: java.nio.file.FileAlreadyExistsException) { }
        }
        cpRequire(Files.isDirectory(file.toPath(), NOFOLLOW_LINKS) && !Files.isSymbolicLink(file.toPath()), "storage_invalid")
        budget()
    }
    private fun regular(file: File) {
        budget()
        cpRequire(fileAccess.regular(file), "storage_invalid")
        budget()
    }
    private fun read(file: File, limit: Int): ByteArray {
        regular(file)
        fileAccess.openRead(file).use { channel ->
            cpRequire(channel.size() in 1..limit.toLong(), "storage_invalid")
            val output = ByteArrayOutputStream()
            val buffer = ByteBuffer.allocate(8192)
            while (true) {
                budget()
                val count = channel.read(buffer)
                budget()
                if (count == -1) break
                cpRequire(output.size() + count <= limit, "storage_invalid")
                output.write(buffer.array(), 0, count); buffer.clear()
            }
            return output.toByteArray()
        }
    }
    private fun embedded(reason: String) = CodePushVersionSelection(CodePushVersionSource.EMBEDDED, reason = reason, nativeRuntimeId = runtime.nativeRuntimeId)
    private fun budget() {
        val elapsed = monotonicNanos() - started
        cpRequire((cleaningUnissuedTrial || (!Thread.currentThread().isInterrupted && selectionActive())) &&
            elapsed in 0 until budgetNanos, "startup_timeout")
    }
    companion object {
        private fun hex(bytes: ByteArray) = bytes.joinToString("") { "%02x".format(it.toInt() and 255) }
        private fun hash(bytes: ByteArray) = hex(MessageDigest.getInstance("SHA-256").digest(bytes))
    }
}
