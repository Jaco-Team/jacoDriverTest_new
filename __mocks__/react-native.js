// __mocks__/react-native.js
const rn = jest.requireActual('react-native');

const def = (obj, key, value) =>
  Object.defineProperty(obj, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });

/** Platform.select — обязателен для @react-native-aria/overlays */
const safeSelect = (spec = {}) =>
  Object.prototype.hasOwnProperty.call(spec, 'ios')
    ? spec.ios
    : Object.prototype.hasOwnProperty.call(spec, 'android')
    ? spec.android
    : spec.default;

def(rn, 'Platform', {
  ...(rn.Platform || {}),
  OS: rn.Platform?.OS || 'ios',
  select: typeof rn.Platform?.select === 'function' ? rn.Platform.select : safeSelect,
});

/** StatusBar.currentHeight — нужен тому же пакету */
const SB = rn.StatusBar || {};
if (typeof SB.currentHeight !== 'number') {
  def(SB, 'currentHeight', 0);
}
def(rn, 'StatusBar', SB);

/** ✅ Dimensions — нужен @gorhom/bottom-sheet и др. */
const dims = {
  window: { width: 375, height: 667, scale: 2, fontScale: 2 },
  screen: { width: 375, height: 667, scale: 2, fontScale: 2 },
};
const listeners = new Set();
const Dimensions = {
  get: (key) => dims[key],
  set: (next) => Object.assign(dims, next),
  addEventListener: (_evt, cb) => {
    listeners.add(cb);
    return { remove: () => listeners.delete(cb) };
  },
  removeEventListener: (_evt, cb) => listeners.delete(cb),
};
def(rn, 'Dimensions', Dimensions);

/** ✅ PixelRatio — часто используют в libs */
const PixelRatio = {
  get: () => 2,
  getFontScale: () => 1,
  roundToNearestPixel: (v) => Math.round(v),
  getPixelSizeForLayoutSize: (s) => Math.round(s * 2),
  startDetecting: () => {},
};
def(rn, 'PixelRatio', PixelRatio);

/** ✅ Keyboard — нужен @gorhom/bottom-sheet (dismiss) */
const Keyboard = {
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  dismiss: jest.fn(),           // <-- главное
};
def(rn, 'Keyboard', Keyboard);

/** ✅ LayoutAnimation — некоторые либы его трогают */
const LayoutAnimation = {
  configureNext: jest.fn(),
  create: jest.fn(),
  easeInEaseOut: jest.fn(),
  linear: jest.fn(),
  spring: jest.fn(),
  Types: {},
  Properties: {},
  Presets: {},
  setEnabled: jest.fn(),
};
def(rn, 'LayoutAnimation', LayoutAnimation);

def(rn, 'InteractionManager', {
  runAfterInteractions: (cb) => {
    if (typeof cb === 'function') {
      cb();
    }
    return { cancel: () => {} };
  },
  createInteractionHandle: jest.fn(() => 1),
  clearInteractionHandle: jest.fn(),
});

/** StyleSheet — страховка */
if (!rn.StyleSheet || typeof rn.StyleSheet.create !== 'function') {
  const StyleSheet = {
    create: (obj) => obj || {},
    flatten: (input) => {
      if (!Array.isArray(input)) return input || {};
      return input.reduce((acc, v) => Object.assign(acc, v || {}), {});
    },
    hairlineWidth: 1,
    absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  };
  def(rn, 'StyleSheet', StyleSheet);
}

/** Твоя бизнес-логика: заглушки для уведомлений */
if (typeof rn.getNotificationSettings !== 'function') {
  def(
    rn,
    'getNotificationSettings',
    jest.fn(async () => ({
      alert: true,
      badge: true,
      sound: true,
      authorizationStatus: 'authorized',
    }))
  );
}
if (typeof rn.requestPermission !== 'function') {
  def(rn, 'requestPermission', jest.fn(async () => true));
}

// в __mocks__/react-native.js после объявления rn и def(...)
const NM = rn.NativeModules || {};
if (!rn.NativeModules) def(rn, 'NativeModules', NM);
if (!NM.ImagePicker) {
  def(NM, 'ImagePicker', {
    // пустые заглушки — они не вызовутся, потому что пакет замокан выше
    launchImageLibrary: jest.fn(),
    launchCamera: jest.fn(),
  });
}

// 🖐️ PanResponder — минимальная реализация для тестов
if (!rn.PanResponder || typeof rn.PanResponder.create !== 'function') {
  const PR = {
    create: jest.fn((handlers = {}) => ({
      panHandlers: {
        onStartShouldSetResponder:
          handlers.onStartShouldSetPanResponder || (() => false),
        onMoveShouldSetResponder:
          handlers.onMoveShouldSetPanResponder || (() => false),
        onResponderMove: handlers.onPanResponderMove || (() => {}),
        onResponderRelease: handlers.onPanResponderRelease || (() => {}),
      },
    })),
  };
  Object.defineProperty(rn, 'PanResponder', {
    value: PR,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

/** TurboModuleRegistry — нужен reanimated и кое-кому ещё */
const TurboModuleRegistry = {
  get: (name) => {
    if (name === 'NativeReanimated') {
      return {
        installCoreFunctions: jest.fn(),
        makeShareableClone: jest.fn((v) => v),
        scheduleOnUI: jest.fn(),
        registerEventHandler: jest.fn(() => 1),
        unregisterEventHandler: jest.fn(),
        getViewProp: jest.fn(async () => null),
        configureProps: jest.fn(),
        createWorkletRuntime: jest.fn(),
        startMapper: jest.fn(),
        stopMapper: jest.fn(),
      };
    }
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
};
def(rn, 'TurboModuleRegistry', TurboModuleRegistry);

/** ESM interop */
def(rn, '__esModule', true);
def(rn, 'default', rn);

const React = require('react');
const mkHost = (name) =>
  React.forwardRef((props, ref) =>
    React.createElement(name, { ref, ...props }, props?.children ?? null)
  );

// Если из requireActual пришло что-то не-функция — подменяем
if (typeof rn.View !== 'function') {
  def(rn, 'View', mkHost('RN_VIEW'));
}

if (typeof rn.Text !== 'function') {
  def(rn, 'Text', mkHost('RN_TEXT'));
}

if (typeof rn.TouchableOpacity !== 'function') {
  def(rn, 'TouchableOpacity', mkHost('RN_TOUCHABLE_OPACITY'));
}
// по желанию — сразу подстрахуем родню:
if (typeof rn.TouchableWithoutFeedback !== 'function') {
  def(rn, 'TouchableWithoutFeedback', mkHost('RN_TOUCHABLE_WITHOUT_FEEDBACK'));
}
if (typeof rn.Pressable !== 'function') {
  def(rn, 'Pressable', mkHost('RN_PRESSABLE'));
}
if (typeof rn.ScrollView !== 'function') {
  def(rn, 'ScrollView', mkHost('RN_SCROLL_VIEW'));
}

module.exports = rn;


