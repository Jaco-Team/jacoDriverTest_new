package com.jacodrivertest.codepush

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.jacodrivertest.BuildConfig
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** Explicit request only; construction does not access storage or start downloads. */
@ReactModule(name = JacoCodePushModule.NAME)
class JacoCodePushModule(private val context: ReactApplicationContext) : NativeCodePushSpec(context) {
    private val executor = Executors.newSingleThreadExecutor { task -> Thread(task, "CodePush-download") }
    // A diagnostic snapshot must release the storage lock before confirmation starts its budget.
    private val lifecycleExecutor = Executors.newSingleThreadExecutor { task -> Thread(task, "CodePush-lifecycle") }
    private val busy = AtomicBoolean(false)
    private val invalidated = AtomicBoolean(false)
    private val confirmed = AtomicBoolean(false)
    private val launchBinding = CodePushStartup.captureLaunchBinding()

    override fun getName(): String = NAME

    protected override fun getTypedExportedConstants(): Map<String, Any> =
        mapOf("embeddedBundleUrl" to "assets://index.android.bundle")

    override fun getLaunchState(promise: Promise) {
        val b = launchBinding
        resolveLaunch(promise, CodePushLaunchResult(if (confirmed.get()) "confirmed" else "running",
            packageId = b.packageId, version = b.version, nativeRuntimeId = b.nativeRuntimeId,
            attemptId = b.attemptId, source = b.source.name.lowercase(java.util.Locale.ROOT)))
    }

    override fun confirmLaunch(attemptId: String, promise: Promise) {
        try {
            lifecycleExecutor.execute {
                val result = try {
                    if (invalidated.get() || !context.hasActiveReactInstance()) CodePushLaunchResult("error", "confirmation_invalid")
                    else CodePushStartup.confirmLaunch(context, launchBinding, attemptId) {
                        !invalidated.get() && context.hasActiveReactInstance()
                    }
                } catch (_: Exception) { CodePushLaunchResult("error", "confirmation_failed") }
                if (result.status == "confirmed") confirmed.set(true)
                resolveLaunch(promise, result)
            }
        } catch (_: java.util.concurrent.RejectedExecutionException) {
            resolveLaunch(promise, CodePushLaunchResult("error", "module_invalidated"))
        }
    }

    override fun markFatal(promise: Promise) {
        try {
            lifecycleExecutor.execute {
                val recorded = try {
                    !BuildConfig.DEBUG && !invalidated.get() &&
                        CodePushStartup.markFatal(context, launchBinding) { !invalidated.get() }
                } catch (_: Exception) { false }
                promise.resolve(recorded)
            }
        } catch (_: java.util.concurrent.RejectedExecutionException) { promise.resolve(false) }
    }

    private fun resolveLaunch(promise: Promise, result: CodePushLaunchResult) {
        promise.resolve(Arguments.createMap().apply {
            putString("status", result.status)
            putString("errorCode", result.errorCode)
            putString("packageId", result.packageId)
            putString("version", result.version)
            putString("nativeRuntimeId", result.nativeRuntimeId)
            putString("attemptId", result.attemptId)
            putString("source", result.source)
        })
    }

    override fun getDiagnostics(promise: Promise) {
        try {
            lifecycleExecutor.execute {
                val values = try {
                    if (invalidated.get()) diagnosticsFailure("module_invalidated") else diagnostics()
                } catch (_: Exception) { diagnosticsFailure("diagnostics_failed") }
                promise.resolve(Arguments.createMap().apply { values.forEach { (key, value) -> putString(key, value) } })
            }
        } catch (_: java.util.concurrent.RejectedExecutionException) {
            promise.resolve(Arguments.createMap().apply { diagnosticsFailure("module_invalidated").forEach { (key, value) -> putString(key, value) } })
        }
    }

    private fun diagnostics(): Map<String, String> {
        val r = CodePushNativeEnvironment.readRuntimeContext(context).runtime
        val storage = if (BuildConfig.DEBUG) CodePushStorageDiagnostics("missing") else CodePushStartup.diagnostics(context)
        val b = launchBinding
        val latest = downloadActivity.snapshot()
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        val build = if (android.os.Build.VERSION.SDK_INT >= 28) info.longVersionCode.toString() else {
            @Suppress("DEPRECATION")
            info.versionCode.toString()
        }
        val error = if (r == null) "runtime_invalid" else storage.errorCode
        return mapOf(
            "status" to if (error.isEmpty()) "ready" else "error", "errorCode" to error,
            "applicationIdentifier" to context.packageName, "nativeBuild" to build,
            "nativeRuntimeId" to (r?.nativeRuntimeId ?: ""),
            "source" to if (BuildConfig.DEBUG) "metro" else b.source.name.lowercase(java.util.Locale.ROOT),
            "launchStatus" to if (BuildConfig.DEBUG) "debug" else if (confirmed.get()) "confirmed" else "running",
            "launchReason" to if (BuildConfig.DEBUG) "debug_metro" else b.reason,
            "launchedPackageId" to b.packageId, "launchedVersion" to b.version,
            "currentPackageId" to storage.currentPackageId, "currentVersion" to storage.currentVersion,
            "previousPackageId" to storage.previousPackageId, "previousVersion" to storage.previousVersion,
            "candidatePackageId" to storage.candidatePackageId, "candidateVersion" to storage.candidateVersion,
            "candidateStatus" to storage.candidateStatus, "lastEvent" to storage.lastEvent,
            "lastEventPackageSha256" to storage.lastEventPackageSha256,
            "downloadStatus" to latest.status, "downloadErrorCode" to latest.errorCode,
            "downloadPackageId" to latest.packageId, "downloadVersion" to latest.version,
            "storageStatus" to storage.storageStatus,
        )
    }

    private fun diagnosticsFailure(code: String): Map<String, String> = mapOf(
        "status" to "error", "errorCode" to code, "applicationIdentifier" to "", "nativeBuild" to "",
        "nativeRuntimeId" to "", "source" to "", "launchStatus" to "error", "launchReason" to "",
        "launchedPackageId" to "", "launchedVersion" to "", "currentPackageId" to "", "currentVersion" to "",
        "previousPackageId" to "", "previousVersion" to "", "candidatePackageId" to "", "candidateVersion" to "",
        "candidateStatus" to "none", "lastEvent" to "", "lastEventPackageSha256" to "",
        "downloadStatus" to "not_checked", "downloadErrorCode" to "", "downloadPackageId" to "", "downloadVersion" to "",
        "storageStatus" to "invalid",
    )

    override fun checkAndDownload(promise: Promise) {
        if (!busy.compareAndSet(false, true)) {
            val result = CodePushDownloadResult("busy")
            downloadActivity.completed(result)
            resolve(promise, result)
            return
        }
        downloadActivity.started()
        try {
            executor.execute {
                try {
                    val environment = CodePushNativeEnvironment.readRuntimeContext(context)
                    val r = environment.runtime
                    val result = if (r == null) {
                        CodePushDownloadResult("error", "runtime_invalid")
                    } else {
                        val runtime = CodePushRuntime(r.appId, r.applicationIdentifier, r.platform,
                            r.nativeRuntimeId, r.nativeBuild, r.rnVersion, r.hermesVersion, r.bundleFormat,
                            r.storageContract.driverOfflineCache, r.storageContract.offlineMaps)
                        CodePushDownloadManager(File(context.noBackupFilesDir, "codepush"), runtime,
                            { CodePushNativeEnvironment.verifyManifest(context, it) }, CodePushHttpTransport())
                            .checkAndDownload()
                    }
                    downloadActivity.completed(result)
                    resolve(promise, result)
                } catch (failure: CodePushFailure) {
                    val result = CodePushDownloadResult("error", failure.code)
                    downloadActivity.completed(result)
                    resolve(promise, result)
                } catch (_: Exception) {
                    val result = CodePushDownloadResult("error", "operation_failed")
                    downloadActivity.completed(result)
                    resolve(promise, result)
                } finally { busy.set(false) }
            }
        } catch (_: java.util.concurrent.RejectedExecutionException) {
            busy.set(false)
            val result = CodePushDownloadResult("error", "module_invalidated")
            downloadActivity.completed(result)
            resolve(promise, result)
        }
    }

    private fun resolve(promise: Promise, result: CodePushDownloadResult) {
        promise.resolve(Arguments.createMap().apply {
            putString("status", result.status)
            putString("errorCode", result.errorCode)
            putString("packageId", result.packageId)
            putString("version", result.version)
            putString("nativeRuntimeId", result.nativeRuntimeId)
            putString("packageSha256", result.packageSha256)
        })
    }

    override fun invalidate() {
        invalidated.set(true)
        executor.shutdownNow()
        lifecycleExecutor.shutdownNow()
        super.invalidate()
    }

    companion object {
        const val NAME = "JacoCodePush"
        private val downloadActivity = CodePushDownloadObservations.activity
    }
}
