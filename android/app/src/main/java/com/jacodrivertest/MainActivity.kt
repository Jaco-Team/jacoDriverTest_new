package com.jacodrivertest

import android.os.Bundle
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

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
