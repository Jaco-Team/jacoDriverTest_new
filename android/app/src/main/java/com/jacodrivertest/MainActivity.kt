package com.jacodrivertest

import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Process
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.jacodrivertest.codepush.CodePushStartup

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "jacoDriverTest"

  override fun onCreate(savedInstanceState: Bundle?) {
    if (!BuildConfig.DEBUG) {
      // Only the asynchronous native launcher can authorize a new OTA attempt.
      // Direct/restored/deep-link entry keeps local code and never waits on network here.
      CodePushStartup.recordLaunchIntent(false)
    }
    installSplashScreen()
    super.onCreate(null) // Передайте null вместо savedInstanceState
  }

  private val trialHandler = Handler(Looper.getMainLooper())
  private val trialExpired = Runnable {
    if (CodePushStartup.trialWatchdogExpired()) restartWithWorkingVersion() else watchTrial(true)
  }

  override fun onResume() {
    super.onResume()
    if (!BuildConfig.DEBUG) watchTrial(true)
  }

  override fun onPause() {
    if (!BuildConfig.DEBUG) watchTrial(false)
    super.onPause()
  }

  private fun watchTrial(inFront: Boolean) {
    trialHandler.removeCallbacks(trialExpired)
    CodePushStartup.trialWatchdogDelay(inFront)?.let { trialHandler.postDelayed(trialExpired, it) }
  }

  /**
   * The trial bundle mounted nothing, so the user sees a blank window. This process cannot
   * switch bundles; its replacement finds the unconfirmed attempt, quarantines it and starts
   * the working version.
   */
  private fun restartWithWorkingVersion() {
    startActivity(Intent.makeRestartActivityTask(ComponentName(this, CodePushLaunchActivity::class.java)))
    finishAffinity()
    Process.killProcess(Process.myPid())
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
