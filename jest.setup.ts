// jest.setup.ts

// 🔔 таймеры
jest.useFakeTimers();

// — жёстко замокаем локальные UI-обёртки
jest.mock('@/components/ui/modal',   () => require('./__mocks__/ui/modalMock.js'));
jest.mock('@/components/ui/vstack',  () => require('./__mocks__/ui/vstackMock.js'));
jest.mock('@/components/ui/text',    () => require('./__mocks__/ui/textMock.js'));
jest.mock('@/components/ui/button',  () => require('./__mocks__/ui/buttonMock.js'));
jest.mock('@/components/ui/icon',    () => require('./__mocks__/ui/iconMock.js'));
jest.mock('@/components/ui/checkbox',() => require('./__mocks__/ui/checkboxMock.js'));
jest.mock('@/components/ui/hstack',  () => require('./__mocks__/ui/hstackMock.js'));


/* ===== ДАЛЬШЕ — КАК У ТЕБЯ (подмодули/зависимости) ===== */

jest.mock('@/shared/lib/notifications', () => ({
  __esModule: true,
  initializeNotifications: jest.fn(async () => () => {}),
  requestNotificationPermission: jest.fn(async () => true),
}));

jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => {
  return jest.fn().mockImplementation(() => ({
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeAllListeners: jest.fn(),
    removeSubscription: jest.fn(),
    emit: jest.fn(),
    listenerCount: jest.fn(),
  }));
});

jest.mock('react-native/Libraries/Utilities/DevSettings', () => ({
  __esModule: true,
  default: {
    addListener: jest.fn(),
    removeListeners: jest.fn(),
    addMenuItem: jest.fn(),
    reload: jest.fn(),
  },
}));

jest.mock('react-native/Libraries/PushNotificationIOS/PushNotificationIOS', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    presentLocalNotification: jest.fn(),
    cancelAllLocalNotifications: jest.fn(),
  },
}));

jest.mock('react-native/Libraries/Settings/NativeSettingsManager', () => ({
  __esModule: true,
  default: {
    getConstants: () => ({ settings: {} }),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  },
}));

jest.mock('react-native/Libraries/ReactNative/NativeI18nManager', () => ({
  __esModule: true,
  default: {
    getConstants: () => ({
      isRTL: false,
      doLeftAndRightSwapInRTL: false,
      localeIdentifier: 'en_US',
    }),
    allowRTL: jest.fn(),
    forceRTL: jest.fn(),
    swapLeftAndRightInRTL: jest.fn(),
  },
}));

jest.mock('react-native/src/private/specs/modules/NativePlatformConstantsIOS', () => {
  const constants = {
    forceTouchAvailable: false,
    interfaceIdiom: 'phone',
    osVersion: '17.0',
    systemName: 'iOS',
    isTesting: true,
  };
  return {
    __esModule: true,
    default: { getConstants: () => constants },
    getConstants: () => constants,
  };
});

jest.mock('react-native/Libraries/Utilities/NativePlatformConstantsIOS', () => {
  const constants = {
    forceTouchAvailable: false,
    interfaceIdiom: 'phone',
    osVersion: '17.0',
    systemName: 'iOS',
    isTesting: true,
  };
  return {
    __esModule: true,
    default: { getConstants: () => constants },
    getConstants: () => constants,
  };
});

jest.mock('react-native/src/private/specs/modules/NativeDeviceInfo', () => {
  const constants = {
    Dimensions: {
      window: { width: 375, height: 667, scale: 2, fontScale: 2 },
      screen: { width: 375, height: 667, scale: 2, fontScale: 2 },
    },
    isIPhoneX_deprecated: false,
    isTesting: true,
  };
  return {
    __esModule: true,
    default: { getConstants: () => constants },
    getConstants: () => constants,
  };
});

jest.mock('react-native/Libraries/Utilities/NativeDeviceInfo', () => {
  const constants = {
    Dimensions: {
      window: { width: 375, height: 667, scale: 2, fontScale: 2 },
      screen: { width: 375, height: 667, scale: 2, fontScale: 2 },
    },
    isIPhoneX_deprecated: false,
    isTesting: true,
  };
  return {
    __esModule: true,
    default: { getConstants: () => constants },
    getConstants: () => constants,
  };
});

jest.mock('react-native/Libraries/Utilities/Dimensions', () => {
  const dims = {
    window: { width: 375, height: 667, scale: 2, fontScale: 2 },
    screen: { width: 375, height: 667, scale: 2, fontScale: 2 },
  };
  const listeners = new Set<any>();
  const api = {
    get: (key: 'window' | 'screen') => dims[key],
    set: (next: any) => Object.assign(dims, next),
    addEventListener: (_: any, cb: any) => {
      listeners.add(cb);
      return { remove: () => listeners.delete(cb) };
    },
    removeEventListener: (_: any, cb: any) => listeners.delete(cb),
  };
  return { __esModule: true, ...api, default: api };
});

jest.mock('react-native/Libraries/Utilities/PixelRatio', () => {
  const api = {
    get: () => 2,
    getFontScale: () => 1,
    roundToNearestPixel: (v: number) => Math.round(v),
    getPixelSizeForLayoutSize: (layout: number) => Math.round(layout * 2),
    startDetecting: () => {},
  };
  return { __esModule: true, ...api, default: api };
});

jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => ({
  __esModule: true,
  get: (name: string) => {
    if (name === 'PushNotificationManager') {
      return {
        getNotificationSettings: jest.fn(async () => ({
          alert: true,
          badge: true,
          sound: true,
          authorizationStatus: 'authorized',
        })),
        requestPermissions: jest.fn(async () => true),
        presentLocalNotification: jest.fn(),
        cancelAllLocalNotifications: jest.fn(),
      };
    }
    if (name === 'KeyboardObserver') {
      return { addListener: jest.fn(), removeListeners: jest.fn() };
    }
    if (name === 'NativeSoundManager' || name === 'SoundManager') {
      return { playTouchSound: jest.fn() };
    }
    return {};
  },
  getEnforcing: () => ({}),
}));

jest.mock('react-native-svg', () => {
  const React = require('react');
  const View = ({ children, ...props }: any) => React.createElement('div', props, children);
  const Mock = View;
  return {
    __esModule: true,
    default: Mock,
    Svg: Mock,
    Path: Mock,
    G: Mock,
    Circle: Mock,
    Rect: Mock,
    Defs: Mock,
    LinearGradient: Mock,
    Stop: Mock,
    ClipPath: Mock,
  };
});

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const NavigationContainer = React.forwardRef((props: any, ref: any) =>
    React.createElement('div', { ref }, props.children)
  );
  const useNavigationContainerRef = () => ({
    current: null,
    getCurrentRoute: () => null,
    resetRoot: () => {},
  });
  const useFocusEffect = (effect: () => void | (() => void)) => {
    React.useEffect(() => (typeof effect === 'function' ? effect() : undefined), []);
  };
  const DefaultTheme = { dark: false, colors: {} };
  const ThemeProvider = ({ children }: any) => children;
  const useTheme = () => ({ colors: {} });
  const createNavigationContainerRef = () => ({ current: null });

  return {
    __esModule: true,
    NavigationContainer,
    useNavigationContainerRef,
    useFocusEffect,
    DefaultTheme,
    ThemeProvider,
    useTheme,
    createNavigationContainerRef,
  };
});

jest.mock('@react-navigation/drawer', () => {
  const React = require('react');
  return {
    __esModule: true,
    createDrawerNavigator: () => ({
      Navigator: ({ children }: any) => React.createElement(React.Fragment, null, children),
      Screen: ({ children }: any) => React.createElement(React.Fragment, null, children),
    }),
  };
});

// 📦 Прочее
const origError = console.error;
console.error = (...args: any[]) => {
  origError(...args);
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async () => undefined),
  getItem: jest.fn(async () => ''),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(() => 1),
  clearWatch: jest.fn(),
  stopObserving: jest.fn(),
  requestAuthorization: jest.fn(),
  setRNConfiguration: jest.fn(),
}));

jest.mock('react-native-permissions', () => {
  const RESULTS = { GRANTED: 'granted' };
  return {
    RESULTS,
    PERMISSIONS: {
      ANDROID: { ACCESS_FINE_LOCATION: 'ACCESS_FINE_LOCATION' },
      IOS: { LOCATION_WHEN_IN_USE: 'LOCATION_WHEN_IN_USE' },
    },
    request: jest.fn(async () => RESULTS.GRANTED),
    checkMultiple: jest.fn(async () => ({})),
  };
});

jest.mock('@notifee/react-native', () => {
  const api = {
    requestPermission: jest.fn(async () => ({ authorizationStatus: 1 })), // AUTHORIZED
    getNotificationSettings: jest.fn(async () => ({ authorizationStatus: 1 })),
    createChannel: jest.fn(async () => 'jacodriver'),
    displayNotification: jest.fn(async () => {}),
    onForegroundEvent: jest.fn(() => () => {}),
    onBackgroundEvent: jest.fn(),
    setBadgeCount: jest.fn(async () => {}),
    getBadgeCount: jest.fn(async () => 0),
  };

  return {
    __esModule: true,
    default: api, // notifee
    // именованные экспорты, которые ты импортируешь
    AuthorizationStatus: {
      NOT_DETERMINED: -1,
      DENIED: 0,
      AUTHORIZED: 1,
      PROVISIONAL: 2,
    },
    AndroidImportance: {
      NONE: 0,
      MIN: 1,
      LOW: 2,
      DEFAULT: 3,
      HIGH: 4,
      MAX: 5,
    },
  };
});

jest.mock('@react-native-firebase/app', () => {
  const appInstance = {
    name: 'mock',
    options: {},
    delete: jest.fn(),
    utils: () => ({ isRunningInTestLab: false }),
  };
  const firebase = {
    app: () => appInstance,
    apps: [appInstance],
    initializeApp: jest.fn(() => appInstance),
    getApp: jest.fn(() => appInstance),
    getApps: jest.fn(() => [appInstance]),
    SDK_VERSION: '0.0.0-test',
  };
  return { __esModule: true, ...firebase, default: firebase };
});

jest.mock('@react-native-firebase/messaging', () => {
  const listeners = { onMessage: [] as Array<(m: any) => void>, onTokenRefresh: [] as Array<(t: string) => void> };
  const api = {
    hasPermission: jest.fn(async () => true),
    requestPermission: jest.fn(async () => true),
    getToken: jest.fn(async () => 'test-fcm-token'),
    deleteToken: jest.fn(async () => undefined),
    isDeviceRegisteredForRemoteMessages: true,
    registerDeviceForRemoteMessages: jest.fn(async () => {}),
    unregisterDeviceForRemoteMessages: jest.fn(async () => {}),
    subscribeToTopic: jest.fn(async () => {}),
    unsubscribeFromTopic: jest.fn(async () => {}),
    setBackgroundMessageHandler: jest.fn(),
    onMessage: jest.fn((cb: (m: any) => void) => {
      listeners.onMessage.push(cb);
      return () => {
        const i = listeners.onMessage.indexOf(cb);
        if (i >= 0) listeners.onMessage.splice(i, 1);
      };
    }),
    onTokenRefresh: jest.fn((cb: (t: string) => void) => {
      listeners.onTokenRefresh.push(cb);
      return () => {
        const i = listeners.onTokenRefresh.indexOf(cb);
        if (i >= 0) listeners.onTokenRefresh.splice(i, 1);
      };
    }),
  };
  return { __esModule: true, default: api, getMessaging: () => api, onMessage: api.onMessage, getToken: api.getToken };
});

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');

  // иногда mock падает на default.call — глушим
  if (!Reanimated.default) Reanimated.default = Reanimated;
  Reanimated.default.call = Reanimated.default.call ?? (() => {});

  // 🟢 самое важное: createAnimatedComponent и на корне, и на default
  const createAnimatedComponent = (Comp: any) => Comp;
  Reanimated.createAnimatedComponent = createAnimatedComponent;
  Reanimated.default.createAnimatedComponent = createAnimatedComponent;

  // подстрахуем базовые штуки
  Reanimated.Easing = Reanimated.Easing ?? {
    linear: (t: number) => t,
    in: (e: any) => e,
    out: (e: any) => e,
    inOut: (e: any) => e,
  };
  Reanimated.Extrapolation = Reanimated.Extrapolation ?? {
    CLAMP: 'clamp',
    EXTEND: 'extend',
    IDENTITY: 'identity',
  };
  Reanimated.interpolate =
    Reanimated.interpolate ??
    ((x: number, input: number[], output: number[]) => {
      let i = 0;
      while (i < input.length - 1 && x > input[i + 1]) i++;
      const x0 = input[i], x1 = input[i + 1] ?? input[i];
      const y0 = output[i], y1 = output[i + 1] ?? output[i];
      return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    });

  return Reanimated;
});

try {
  require.resolve('react-native/Libraries/Animated/NativeAnimatedHelper');
  jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}));
} catch {
}

;(global as any).fetch = jest.fn(async () => ({ ok: true, json: async () => ({}) } as any));

jest.mock('query-string', () => ({
  __esModule: true,
  default: {
    stringify: (obj: any) => new URLSearchParams(obj as any).toString(),
    parse: (s: string) => Object.fromEntries(new URLSearchParams(s)),
  },
}));

jest.mock('react-native-screens', () => require('react-native-screens/mock'));

jest.mock('@react-native-clipboard/clipboard', () => {
  const api = {
    setString: jest.fn(),
    getString: jest.fn(async () => ''),
    hasString: jest.fn(async () => false),
    getStringURL: jest.fn(async () => null),
  };
  return { __esModule: true, default: api, ...api };
});

jest.mock('react-native-yamap', () => {
  const React = require('react');
  const YaMap = (props: any) => React.createElement(React.Fragment, null, props?.children);
  (YaMap as any).init = jest.fn();
  (YaMap as any).setLocale = jest.fn();
  (YaMap as any).setCenter = jest.fn();
  (YaMap as any).setZoom = jest.fn();
  const Animation = { SMOOTH: 0 };
  return { __esModule: true, default: YaMap, Animation };
});

jest.mock('@sentry/react-native', () => {
  const api = {
    init: jest.fn(),
    wrap: (Comp: any) => Comp,
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
    setTag: jest.fn(),
    setUser: jest.fn(),
    setContext: jest.fn(),
    withScope: (cb: any) => cb?.({ setTag: () => {}, setContext: () => {} }),
    ReactNavigationInstrumentation: function () {},
  };
  return { __esModule: true, ...api, default: api };
});

jest.mock('@/components/ui/gluestack-ui-provider', () => {
  const React = require('react');
  const Provider = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  return { __esModule: true, default: Provider, GluestackUIProvider: Provider };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const defaultInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  const defaultFrame = { x: 0, y: 0, width: 360, height: 640 };
  const SafeAreaInsetsContext = React.createContext(defaultInsets);
  const SafeAreaFrameContext = React.createContext(defaultFrame);
  const useSafeAreaInsets = () => React.useContext(SafeAreaInsetsContext);
  const useSafeAreaFrame = () => React.useContext(SafeAreaFrameContext);
  const SafeAreaProvider = ({ children, initialMetrics }: any) =>
    React.createElement(
      SafeAreaInsetsContext.Provider,
      { value: initialMetrics?.insets ?? defaultInsets },
      React.createElement(
        SafeAreaFrameContext.Provider,
        { value: initialMetrics?.frame ?? defaultFrame },
        children,
      ),
    );
  const SafeAreaView = ({ children }: any) => React.createElement('div', null, children);
  const initialWindowMetrics = { insets: defaultInsets, frame: defaultFrame };
  const exports = {
    SafeAreaProvider,
    SafeAreaView,
    useSafeAreaInsets,
    useSafeAreaFrame,
    SafeAreaInsetsContext,
    SafeAreaFrameContext,
    initialWindowMetrics,
  };
  return { __esModule: true, ...exports, default: exports };
});

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const View = ({ children }: any) => React.createElement('div', null, children);
  const Handler = View;
  const State = { UNDETERMINED: 0, FAILED: 1, BEGAN: 2, CANCELLED: 3, ACTIVE: 4, END: 5 };
  const Directions = { RIGHT: 1, LEFT: 2, UP: 4, DOWN: 8 };
  const chain = new Proxy({}, { get: () => () => chain });
  const Gesture = { Pan: () => chain, Tap: () => chain, LongPress: () => chain, Fling: () => chain, Native: () => chain, Race: () => chain, Simultaneous: () => chain };
  const GestureDetector = ({ children }: any) => React.createElement('div', null, children);
  return {
    __esModule: true,
    State,
    Directions,
    GestureHandlerRootView: View,
    PanGestureHandler: Handler,
    TapGestureHandler: Handler,
    FlingGestureHandler: Handler,
    LongPressGestureHandler: Handler,
    PinchGestureHandler: Handler,
    RotationGestureHandler: Handler,
    ForceTouchGestureHandler: Handler,
    NativeViewGestureHandler: Handler,
    RectButton: View,
    BorderlessButton: View,
    RawButton: View,
    BaseButton: View,
    TouchableHighlight: View,
    TouchableOpacity: View,
    Gesture,
    GestureDetector,
    createNativeWrapper: (Comp: any) => Comp,
    attachGestureHandler: () => {},
    setGestureHandlerState: () => {},
  };
});

jest.mock('react-native-modal-datetime-picker', () => {
  const React = require('react');
  const Mock = ({ isVisible, ...rest }: any) =>
    React.createElement('div', { 'data-testid': 'rn-mdtp', 'data-visible': !!isVisible, ...rest });
  return Mock;
});

jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  return function MockCommunityPicker(props: any) {
    return React.createElement('div', { 'data-testid': 'community-dtpicker', ...props });
  };
});

// 🔴 Мок react-native-wheel-color-picker (пакет дергает PanResponder.create)
jest.mock('react-native-wheel-color-picker', () => {
  const React = require('react');
  const { View } = require('react-native');
  // Простейший «контрол» вместо нативного пикера
  const MockColorPicker = (props: any) =>
    React.createElement(View, { 'data-testid': 'rn-wheel-color-picker', ...props });
  return MockColorPicker;
});

// ⬇️ ДОБАВЬ ЭТО В jest.setup.ts (где у тебя уже остальные моки)
jest.mock('@gluestack-ui/actionsheet', () => {
  const React = require('react');

  const makeBox = (tag = 'div') =>
    React.forwardRef((props: any, ref: any) =>
      React.createElement(tag, { ...props, ref }, props?.children)
    );

  const createActionsheet = () => {
    const Actionsheet = makeBox();
    const ActionsheetBackdrop = makeBox();
    const ActionsheetContent = makeBox();
    const ActionsheetDragIndicator = makeBox('span');
    const ActionsheetDragIndicatorWrapper = makeBox();
    const ActionsheetItem = makeBox('button');
    const ActionsheetItemText = makeBox('span');
    const ActionsheetIcon = makeBox('span');

    return {
      Actionsheet,
      ActionsheetBackdrop,
      ActionsheetContent,
      ActionsheetDragIndicator,
      ActionsheetDragIndicatorWrapper,
      ActionsheetItem,
      ActionsheetItemText,
      ActionsheetIcon,
    };
  };

  return { __esModule: true, createActionsheet };
});

// 📸 mock react-native-image-picker
jest.mock('react-native-image-picker', () => {
  const success = {
    didCancel: false,
    assets: [
      {
        uri: 'file:///mock.jpg',
        fileName: 'mock.jpg',
        type: 'image/jpeg',
        width: 100,
        height: 100,
        fileSize: 1234,
      },
    ],
  };

  const launch = (_opts?: any, cb?: (res: any) => void) => {
    if (typeof cb === 'function') cb(success);
    return Promise.resolve(success);
  };

  return {
    __esModule: true,
    launchImageLibrary: jest.fn(launch),
    launchCamera: jest.fn(launch),
    // иногда кто-то импортирует ещё эти именованные:
    CameraOptions: {},
    ImageLibraryOptions: {},
  };
});

// 📦 mock @gluestack-ui/modal целиком (возвращаем простые <div/>-обёртки)
jest.mock('@gluestack-ui/modal', () => {
  const React = require('react');

  const wrap = (tag = 'div') =>
    React.forwardRef((props: any, ref: any) =>
      React.createElement(tag, { ...props, ref }, props?.children)
    );

  // Игнорируем все конфиги — просто возвращаем набор примитивных компонентов
  const createModal = () => ({
    Modal: wrap(),
    ModalBackdrop: wrap(),
    ModalContent: wrap(),
    ModalHeader: wrap(),
    ModalFooter: wrap(),
    ModalBody: wrap(),
    ModalCloseButton: wrap('button'),
  });

  return { __esModule: true, createModal };
});

// == ЛОКАЛЬНАЯ обёртка модалки: глушим целиком ==
jest.mock('@/components/ui/modal', () => {
  const React = require('react');
  const wrap = (tag = 'div') =>
    React.forwardRef((props: any, ref: any) =>
      React.createElement(tag, { ...props, ref }, props?.children)
    );

  return {
    __esModule: true,
    Modal: wrap(),
    ModalBackdrop: wrap(),
    ModalContent: wrap(),
    ModalHeader: wrap(),
    ModalFooter: wrap(),
    ModalBody: wrap(),
    ModalCloseButton: wrap('button'),
  };
});

// == ЛОКАЛЬНАЯ обёртка actionsheet (если используешь '@/components/ui/actionsheet') ==
jest.mock('@/components/ui/actionsheet', () => {
  const React = require('react');
  const box = (tag = 'div') => (props: any) =>
    React.createElement(tag, props, props?.children);

  const createActionsheet = () => {
    const Actionsheet = box();
    const ActionsheetBackdrop = box();
    const ActionsheetContent = box();
    const ActionsheetDragIndicator = box('span');
    const ActionsheetDragIndicatorWrapper = box();
    const ActionsheetItem = box('button');
    const ActionsheetItemText = box('span');
    const ActionsheetIcon = box('span');

    return {
      Actionsheet,
      ActionsheetBackdrop,
      ActionsheetContent,
      ActionsheetDragIndicator,
      ActionsheetDragIndicatorWrapper,
      ActionsheetItem,
      ActionsheetItemText,
      ActionsheetIcon,
    };
  };

  return { __esModule: true, createActionsheet };
});

// --- ТЕСТОВЫЕ ЗАГЛУШКИ ДЛЯ СЛОЖНЫХ UI ---
jest.mock('@/shared/ui/CustomAlert', () => {
  const React = require('react');
  const { Fragment, createElement } = React;
  const Mock = ({ children }: any) => createElement(Fragment, null, children);
  return { __esModule: true, default: Mock };
});

jest.mock('@/shared/ui/ModalText', () => {
  const React = require('react');
  const { createElement } = React;
  const Mock = (props: any) => createElement('div', props, props?.children);
  return { __esModule: true, default: Mock };
});

// ---- bottom-sheet: единый мок для всех путей ----
const makeMockBottomSheet = () => {
  const React = require('react');
  const Box = (props: any) => React.createElement('div', props, props?.children);
  const BottomSheetModalProvider = ({ children }: any) =>
    React.createElement(React.Fragment, null, children);

  return {
    __esModule: true,
    default: Box,
    BottomSheetBackdrop: Box,
    BottomSheetScrollView: Box,
    BottomSheetView: Box,
    BottomSheetModal: Box,
    BottomSheetModalProvider,
    useBottomSheetModal: () => ({ present: jest.fn(), dismiss: jest.fn() }),
    useBottomSheet: () => ({ expand: jest.fn(), close: jest.fn() }),
  };
};

const mockBottomSheet = makeMockBottomSheet();

jest.mock('@gorhom/bottom-sheet', () => mockBottomSheet);
// глубокие импорты — тот же объект, без require внутри фабрики
jest.mock('@gorhom/bottom-sheet/lib/module', () => mockBottomSheet);
jest.mock('@gorhom/bottom-sheet/lib/commonjs', () => mockBottomSheet);

// jest.setup.ts – если мокаешь UiProviders, экспорт должен называться UiProvider
jest.mock('@/app/providers/UiProviders', () => {
  const React = require('react');
  const C = ({ children }: any) => React.createElement(React.Fragment, null, children);
  return { __esModule: true, default: C, UiProvider: C }; // именно UiProvider
});

jest.mock('@/app/providers/AppProviders', () => {
  const React = require('react');
  const C = ({ children }: any) => React.createElement(React.Fragment, null, children);
  return { __esModule: true, default: C, AppProviders: C };
});

jest.mock('@/analytics/AppMetricaService', () => {
  const service = {
    Analytics: { init: jest.fn(), log: jest.fn(), setUserId: jest.fn() },
    AnalyticsEvent: new Proxy({}, { get: (_: any, k: any) => String(k) }),
    installJsCrashHandler: jest.fn(), // <-- ВАЖНО
  };
  return {
    __esModule: true,
    ...service,      // именованные импорты
    default: service // на случай где-то есть default-импорт
  };
});

// jest.setup.ts

// --- mock NetInfo ---
jest.mock('@react-native-community/netinfo', () => {
  const listeners = new Set<Function>();

  const addEventListener = (cb: any) => {
    listeners.add(cb);
    // сразу же можно один раз дернуть колбэк “как будто онлайн”
    try {
      cb({
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
        details: { isConnectionExpensive: false },
      });
    } catch {}

    return () => listeners.delete(cb);
  };

  const fetch = jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
    details: { isConnectionExpensive: false },
  }));

  const NetInfo = { addEventListener, fetch };

  return {
    __esModule: true,
    default: NetInfo,
    addEventListener,
    fetch,
  };
});

// --- mock DeviceInfo ---
jest.mock('react-native-device-info', () => {
  const api = {
    isLocationEnabled: jest.fn(async () => true),
    // на всякий: часто юзают и эти методы
    getUniqueId: jest.fn(() => 'test-unique-id'),
    getVersion: jest.fn(() => '0.0.0-test'),
    getBuildNumber: jest.fn(() => '1'),
    // ...добавляй по мере надобности
  };
  return { __esModule: true, default: api, ...api };
});

if (typeof beforeEach === 'function' && typeof afterEach === 'function') {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    try { jest.clearAllTimers(); } catch {}
    jest.clearAllMocks();
    jest.useRealTimers();
    try {
      const m = require('@react-native-firebase/messaging');
      typeof m.__resetMocks === 'function' && m.__resetMocks();
    } catch {}
  });

  afterAll(async () => {
    jest.useRealTimers();
    await new Promise((r) => setImmediate(r));
  });
}
