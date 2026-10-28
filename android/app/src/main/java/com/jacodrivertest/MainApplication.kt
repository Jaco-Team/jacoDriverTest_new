package com.jacodrivertest

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.jacodrivertest.codepush.JacoCodePushPackage
import com.jacodrivertest.codepush.CodePushStartup

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    val selectedBundle = if (BuildConfig.DEBUG) null else CodePushStartup.bundlePath(applicationContext, false)
    getDefaultReactHost(
      context = applicationContext,
      jsBundleFilePath = selectedBundle,
      useDevSupport = BuildConfig.DEBUG,
      packageList =
        PackageList(this).packages.apply {
          add(JacoCodePushPackage())
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
