import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

import YandexMapsMobile
import Firebase

@main
class AppDelegate: RCTAppDelegate {
  private(set) var reactNativeLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?

  override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
    // UIKit owns the window through SceneDelegate on iOS 15+.
    self.automaticallyLoadReactNativeWindow = false
    self.reactNativeLaunchOptions = launchOptions
    self.moduleName = "jacoDriverTest"
    self.dependencyProvider = RCTAppDependencyProvider()

    // You can add your custom initial props in the dictionary below.
    // They will be passed down to the ViewController used by React Native.
    self.initialProps = [:]

    YMKMapKit.setLocale("ru_RU")
    guard let configURL = Bundle.main.url(forResource: "MapKitConfig", withExtension: "json"),
          let configData = try? Data(contentsOf: configURL),
          let config = try? JSONDecoder().decode(MapKitConfiguration.self, from: configData),
          !config.apiKey.isEmpty else {
      fatalError("MapKit configuration is missing. Set YAMAP_API_KEY in .env and rebuild the app.")
    }
    YMKMapKit.setApiKey(config.apiKey)
    
    FirebaseApp.configure()
    
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey : Any] = [:]
  ) -> Bool {
    RCTLinkingManager.application(app, open: url, options: options)
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

private struct MapKitConfiguration: Decodable {
  let apiKey: String
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
      return
    }

    var launchOptions = appDelegate.reactNativeLaunchOptions ?? [:]
    if let context = connectionOptions.urlContexts.first {
      launchOptions[.url] = context.url
      if let sourceApplication = context.options.sourceApplication {
        launchOptions[.sourceApplication] = sourceApplication
      }
    }
    if let activity = connectionOptions.userActivities.first {
      launchOptions[.userActivityDictionary] = ["UIApplicationLaunchOptionsUserActivityKey": activity]
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    appDelegate.reactNativeFactory.startReactNative(
      withModuleName: "jacoDriverTest",
      in: window,
      initialProperties: appDelegate.initialProps,
      launchOptions: launchOptions
    )
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }
}
