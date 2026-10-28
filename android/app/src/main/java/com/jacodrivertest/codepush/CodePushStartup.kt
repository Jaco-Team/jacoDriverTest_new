package com.jacodrivertest.codepush

import android.content.Context
import android.system.Os
import android.system.OsConstants
import java.io.File
import java.io.FileInputStream
import java.nio.channels.FileChannel
import java.util.UUID
import java.util.concurrent.atomic.AtomicReference
import java.util.concurrent.atomic.AtomicBoolean

/** One ordinary-opening selection; a running ReactHost is never restarted. */
object CodePushStartup {
    private val cache = CodePushStartupCache()
    private val preflight = CodePushPreflightCache()
    private val launchProvenance = CodePushLaunchProvenance()
    private val verifiedBaseline = AtomicReference<CodePushVersionSelection?>()
    private val openingForeground = AtomicReference<() -> Boolean>({ true })
    private val mainHandoff = AtomicBoolean(false)
    private val processToken: String by lazy { UUID.randomUUID().toString().replace("-", "") }

    fun recordLaunchIntent(ordinaryLauncher: Boolean, foreground: () -> Boolean = { true }) {
        if (launchProvenance.record(ordinaryLauncher)) openingForeground.set(foreground)
    }

    /** Invoked by the native launch window on a background thread, never from ReactActivity. */
    fun prepare(context: Context, ordinaryOpening: Boolean, foreground: () -> Boolean) {
        recordLaunchIntent(ordinaryOpening, foreground)
        if (cache.peek() != null) return
        val started = System.nanoTime()
        val active = {
            preflight.preparationIsActive() && openingForeground.get().invoke() &&
                !Thread.currentThread().isInterrupted && System.nanoTime() - started in 0 until 8_000_000_000L
        }
        preflight.prepare({ verifiedBaseline.get() }) {
            val store = store(context, active) { verifiedBaseline.compareAndSet(null, it) }
            if (store == null) CodePushPreflightResult(CodePushVersionSelection(
                CodePushVersionSource.EMBEDDED, reason = "runtime_invalid"), false)
            else CodePushColdPreflight(selectionActive = active).prepare(
                ordinaryOpening && launchProvenance.freezeEligibility(),
                selectBaseline = { store.select(allowTrial = false) },
                publishBaseline = { verifiedBaseline.compareAndSet(null, it) },
                download = { download(context) })
        }
    }

    /** The launcher hands an ordinary foreground opening to MainActivity after preflight. */
    fun handoffToMain() { mainHandoff.set(true) }

    fun cancelOpeningForExternalIntent() {
        mainHandoff.set(false)
        preflight.disallowTrial(verifiedBaseline.get() ?: CodePushVersionSelection(
            CodePushVersionSource.EMBEDDED, reason = "external_start"))
    }

    fun bundlePath(context: Context, debug: Boolean): String? {
        val handoff = mainHandoff.getAndSet(false)
        val prepared = preflight.peek() ?: if (preflight.preparationIsActive())
            preflight.freezeFallback(verifiedBaseline.get() ?: CodePushVersionSelection(
                CodePushVersionSource.EMBEDDED, reason = "preflight_skipped")) else null
        val allowTrial = !debug && handoff && launchProvenance.freezeEligibility() &&
            openingForeground.get().invoke() && prepared?.allowTrial == true
        val started = System.nanoTime()
        val active = {
            cache.selectionIsActive() && !Thread.currentThread().isInterrupted &&
                System.nanoTime() - started in 0 until 2_000_000_000L
        }
        return cache.selectWithFallback(debug, { verifiedBaseline.get() }, { rejected ->
            store(context)?.rejectUnlaunchedTrial(rejected)
        }) {
            if (!allowTrial && prepared != null) return@selectWithFallback prepared.baseline
            val store = store(context, active) { verifiedBaseline.compareAndSet(null, it) }
                ?: return@selectWithFallback CodePushVersionSelection(
                CodePushVersionSource.EMBEDDED, reason = "runtime_invalid")
            store.select(allowTrial = allowTrial).withVerifiedStartupFallback(verifiedBaseline.get())
        }.bundlePath
    }

    fun captureLaunchBinding(): CodePushVersionSelection = cache.peek()
        ?: CodePushVersionSelection(CodePushVersionSource.EMBEDDED, reason = "launch_unavailable")

    fun diagnostics(context: Context): CodePushStorageDiagnostics = store(context)?.diagnostics()
        ?: CodePushStorageDiagnostics("invalid", "runtime_invalid")

    fun confirmLaunch(context: Context, binding: CodePushVersionSelection, attemptId: String,
        bindingValid: () -> Boolean): CodePushLaunchResult {
        if (binding !== cache.peek()) return CodePushLaunchResult("error", "confirmation_invalid")
        return store(context)?.confirmLaunch(binding, attemptId, bindingValid)
            ?: CodePushLaunchResult("error", "runtime_invalid")
    }

    fun markFatal(context: Context, binding: CodePushVersionSelection, bindingValid: () -> Boolean): Boolean {
        if (binding !== cache.peek()) return false
        return store(context)?.markFatal(binding, bindingValid) ?: false
    }

    private fun store(context: Context, selectionActive: () -> Boolean = { true },
        onVerifiedBaseline: (CodePushVersionSelection) -> Unit = {}): CodePushVersionStore? {
        val application = context.applicationContext ?: context
        val r = CodePushNativeEnvironment.readRuntimeContext(application).runtime
            ?: return null
        val runtime = CodePushRuntime(r.appId, r.applicationIdentifier, r.platform, r.nativeRuntimeId,
            r.nativeBuild, r.rnVersion, r.hermesVersion, r.bundleFormat,
            r.storageContract.driverOfflineCache, r.storageContract.offlineMaps)
        return CodePushVersionStore(File(application.noBackupFilesDir, "codepush"), runtime,
            { CodePushNativeEnvironment.verifyManifest(application, it) },
            fileAccess = AndroidVersionFileAccess, processToken = processToken, selectionActive = selectionActive,
            onVerifiedBaseline = onVerifiedBaseline)
    }

    private fun download(context: Context): CodePushDownloadResult {
        val activity = CodePushDownloadObservations.activity
        activity.started()
        val result = try {
            val application = context.applicationContext ?: context
            val r = CodePushNativeEnvironment.readRuntimeContext(application).runtime
            if (r == null) CodePushDownloadResult("error", "runtime_invalid") else {
                val runtime = CodePushRuntime(r.appId, r.applicationIdentifier, r.platform, r.nativeRuntimeId,
                    r.nativeBuild, r.rnVersion, r.hermesVersion, r.bundleFormat,
                    r.storageContract.driverOfflineCache, r.storageContract.offlineMaps)
                CodePushDownloadManager(File(application.noBackupFilesDir, "codepush"), runtime,
                    { CodePushNativeEnvironment.verifyManifest(application, it) }, CodePushHttpTransport())
                    .checkAndDownload()
            }
        } catch (failure: CodePushFailure) { CodePushDownloadResult("error", failure.code) }
        catch (_: Exception) { CodePushDownloadResult("error", "operation_failed") }
        activity.completed(result)
        return result
    }
}

/** Checks the actual opened inode; the Java unix attribute view is not assumed on Android. */
private object AndroidVersionFileAccess : CodePushVersionFileAccess {
    override fun regular(file: File): Boolean = try {
        val stat = Os.lstat(file.absolutePath)
        stat.st_nlink == 1L && OsConstants.S_ISREG(stat.st_mode)
    } catch (_: Exception) { false }

    override fun openRead(file: File): FileChannel {
        val descriptor = Os.open(file.absolutePath,
            OsConstants.O_RDONLY or OsConstants.O_CLOEXEC or OsConstants.O_NOFOLLOW or OsConstants.O_NONBLOCK, 0)
        try {
            val stat = Os.fstat(descriptor)
            cpRequire(stat.st_nlink == 1L && OsConstants.S_ISREG(stat.st_mode), "storage_invalid")
            return FileInputStream(descriptor).channel
        } catch (failure: Exception) {
            try { Os.close(descriptor) } catch (_: Exception) { }
            throw failure
        }
    }
}
