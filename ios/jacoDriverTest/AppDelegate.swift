import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

import YandexMapsMobile
import Firebase

@main
class AppDelegate: RCTAppDelegate {
  private(set) var reactNativeLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?
  private(set) var didStartReactNative = false
  private weak var startupScene: SceneDelegate?

  func registerStartupScene(_ scene: SceneDelegate) { startupScene = scene }
  func unregisterStartupScene(_ scene: SceneDelegate) {
    if startupScene === scene { startupScene = nil }
  }
  func markReactNativeStarted() { didStartReactNative = true }

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
    if !didStartReactNative {
      if let startupScene = startupScene {
        startupScene.receiveInitialURL(url, sourceApplication: options[.sourceApplication] as? String)
      } else {
        var launch = reactNativeLaunchOptions ?? [:]
        launch[.url] = url
        if let source = options[.sourceApplication] { launch[.sourceApplication] = source }
        reactNativeLaunchOptions = launch
        CodePushStartup.restrictToExistingCode()
      }
      return true
    }
    return RCTLinkingManager.application(app, open: url, options: options)
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    CodePushStartup.bundleURL(embeddedURL: Bundle.main.url(forResource: "main", withExtension: "jsbundle"))
#endif
  }
}

private struct MapKitConfiguration: Decodable {
  let apiKey: String
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?
  private var startOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
  private var ordinaryEntry = false
  private var reactNativeStarted = false
  private var preflightStarted = false
  private var preflightGeneration = 0
  private weak var connectedScene: UIScene?

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
    connectedScene = scene
    appDelegate.registerStartupScene(self)
    startOptions = launchOptions
    ordinaryEntry = CodePushSceneEntryPolicy.isOrdinary(
      windowApplication: session.role == .windowApplication,
      applicationLaunchKeys: Set((appDelegate.reactNativeLaunchOptions ?? [:]).keys.map(\.rawValue)),
      hasURL: !connectionOptions.urlContexts.isEmpty,
      hasUserActivity: !connectionOptions.userActivities.isEmpty,
      hasNotification: connectionOptions.notificationResponse != nil,
      hasShortcut: connectionOptions.shortcutItem != nil
    )
    // willConnect may still report background for an icon launch. Ordinary UI
    // waits for the foreground lifecycle callback; external starts keep their
    // original code and are never restarted by the later foreground transition.
    if appDelegate.didStartReactNative {
      // Reconnecting a scene attaches a surface to the existing host. It is
      // never a new update opportunity, and its external events go to that JS.
      startReactNative(ordinaryUI: false)
      for context in connectionOptions.urlContexts {
        RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
      }
      for activity in connectionOptions.userActivities {
        RCTLinkingManager.application(UIApplication.shared, continue: activity, restorationHandler: { _ in })
      }
    } else if !ordinaryEntry { startReactNative(ordinaryUI: false) }
    else if windowScene.activationState == .foregroundActive || windowScene.activationState == .foregroundInactive {
      prepareOrdinaryUI()
    }
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    if ordinaryEntry { prepareOrdinaryUI() }
    else { startReactNative(ordinaryUI: false) }
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    if ordinaryEntry { prepareOrdinaryUI() }
    else { startReactNative(ordinaryUI: false) }
  }

  func sceneDidDisconnect(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?.unregisterStartupScene(self)
    connectedScene = nil
    preflightGeneration += 1
    preflightStarted = false
    if !reactNativeStarted { CodePushStartup.restrictToExistingCode() }
  }

  private func prepareOrdinaryUI() {
    guard !reactNativeStarted, !preflightStarted, let window = window, connectedScene != nil else { return }
    preflightStarted = true
    preflightGeneration += 1
    let generation = preflightGeneration
    window.rootViewController = UIStoryboard(name: "LaunchScreen", bundle: .main).instantiateInitialViewController()
    window.makeKeyAndVisible()
    CodePushStartup.prepareForNormalUI { [weak self] in
      guard let self = self, generation == self.preflightGeneration else { return }
      self.preflightStarted = false
      guard !self.reactNativeStarted, self.ordinaryEntry, let scene = self.connectedScene,
            scene.activationState == .foregroundActive || scene.activationState == .foregroundInactive else { return }
      self.startReactNative(ordinaryUI: true)
    }
  }

  private func startReactNative(ordinaryUI: Bool) {
    guard !reactNativeStarted, connectedScene != nil, let window = window,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    reactNativeStarted = true
    preflightGeneration += 1
    preflightStarted = false
    if !ordinaryUI { CodePushStartup.restrictToExistingCode() }
    CodePushStartup.markNormalUIStart(ordinaryUI)
    appDelegate.markReactNativeStarted()
    appDelegate.reactNativeFactory.startReactNative(
      withModuleName: "jacoDriverTest",
      in: window,
      initialProperties: appDelegate.initialProps,
      launchOptions: startOptions
    )
  }

  func receiveInitialURL(_ url: URL, sourceApplication: String?) {
    guard !reactNativeStarted else { return }
    ordinaryEntry = false
    startOptions[.url] = url
    if let source = sourceApplication { startOptions[.sourceApplication] = source }
    startReactNative(ordinaryUI: false)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    if !reactNativeStarted, let context = URLContexts.first {
      receiveInitialURL(context.url, sourceApplication: context.options.sourceApplication)
      for context in URLContexts.dropFirst() {
        RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
      }
      return
    }
    for context in URLContexts {
      RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    if !reactNativeStarted {
      ordinaryEntry = false
      startOptions[.userActivityDictionary] = ["UIApplicationLaunchOptionsUserActivityKey": userActivity]
      startReactNative(ordinaryUI: false)
      return
    }
    RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }
}
