package com.jacodrivertest

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.jacodrivertest.codepush.CodePushStartup
import java.util.concurrent.atomic.AtomicBoolean

/** Keeps the native launch screen responsive while the first ordinary opening checks S3. */
class CodePushLaunchActivity : Activity() {
    private val openingActive = AtomicBoolean(true)
    private var resumed = false
    private var ready = false
    private var forwarded = false

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        splash.setKeepOnScreenCondition { !forwarded }
        setContentView(View(this).apply { setBackgroundResource(R.color.splash_background) })
        val ordinary = isOrdinaryOpening(intent)
        if (BuildConfig.DEBUG) {
            ready = true
            return
        }
        val application = applicationContext
        val token = openingActive
        CodePushStartup.recordLaunchIntent(ordinary) { token.get() }
        Thread({
            CodePushStartup.prepare(application, ordinary) { token.get() }
            runOnUiThread {
                if (!isFinishing && !isDestroyed) {
                    ready = true
                    forwardIfReady()
                }
            }
        }, "CodePush-launch-window").apply { isDaemon = true; start() }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (forwarded) {
            // The first handoff is already in progress; keep subsequent notification data intact.
            startActivity(intentForMain(intent))
            finish()
            return
        }
        if (!isOrdinaryOpening(intent)) {
            openingActive.set(false)
            if (!BuildConfig.DEBUG) CodePushStartup.cancelOpeningForExternalIntent()
            ready = true
        }
        forwardIfReady()
    }

    override fun onResume() {
        super.onResume()
        resumed = true
        forwardIfReady()
    }

    override fun onPause() {
        resumed = false
        super.onPause()
    }

    override fun onStop() {
        if (!forwarded) openingActive.set(false)
        super.onStop()
    }

    override fun onDestroy() {
        if (!forwarded) openingActive.set(false)
        super.onDestroy()
    }

    private fun forwardIfReady() {
        if (!ready || !resumed || forwarded || isFinishing || isDestroyed) return
        forwarded = true
        if (!BuildConfig.DEBUG && isOrdinaryOpening(intent) && openingActive.get()) CodePushStartup.handoffToMain()
        startActivity(intentForMain(intent))
        finish()
    }

    private fun isOrdinaryOpening(source: Intent?): Boolean = source != null &&
        source.action == Intent.ACTION_MAIN && source.hasCategory(Intent.CATEGORY_LAUNCHER) &&
        source.data == null && source.extras?.isEmpty != false

    private fun intentForMain(source: Intent): Intent {
        val next = Intent(source).setClass(this, MainActivity::class.java)
        next.flags = (next.flags and (Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_MULTIPLE_TASK or
            Intent.FLAG_ACTIVITY_NEW_DOCUMENT).inv()) or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        return next
    }
}
