/** @type {import('jest').Config} */
module.exports = {
  preset: 'react-native',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  roots: ['<rootDir>'],

  // Надёжный паттерн из доков Jest
  testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],

  transformIgnorePatterns: [
    'node_modules/(?!(?:@react-native|react-native|@react-navigation|@react-navigation/elements|@react-navigation/drawer|@react-navigation/native|@react-navigation/native-stack|@react-navigation/routers|react-native-drawer-layout|@react-native-firebase|@notifee|@gluestack-ui|@gorhom|react-native-yamap|react-native-reanimated|react-native-gesture-handler|nativewind|react-native-css-interop|@legendapp/motion|@expo/html-elements|react-native-wheel-color-picker|@fortawesome/react-native-fontawesome|@fortawesome/free-solid-svg-icons|@fortawesome/fontawesome-svg-core|react-native-modal-datetime-picker|@react-native-community/datetimepicker|react-native-image-viewing|react-native-image-picker)/)',
  ],

  moduleNameMapper: {
    '^react-native$': '<rootDir>/__mocks__/react-native.js',

    // сторонние
    '^@react-spring/native$': '<rootDir>/__mocks__/reactSpringNativeMock.js',
    '^@expo/html-elements$': '<rootDir>/__mocks__/expoHtmlElementsMock.js',
    '^@legendapp/motion$': '<rootDir>/__mocks__/legendMotionMock.js',
    '^firebase/app$': '<rootDir>/__mocks__/firebaseAppMock.js',

    // css-interop / nativewind в заглушку
    '^(?:react-native-css-interop)(?:/.+)?$': '<rootDir>/__mocks__/emptyModule.js',
    '^react-native-css-interop-jsx-pragma-check$': '<rootDir>/__mocks__/emptyModule.js',
    '^react-native-css-interop/jsx-pragma-check$': '<rootDir>/__mocks__/emptyModule.js',
    '^(?:nativewind)(?:/.+)?$': '<rootDir>/__mocks__/nativewindMock.js',
    '^@gluestack-ui/nativewind-utils(?:/.+)?$': '<rootDir>/__mocks__/gluestackNativewindUtilsMock.js',
    '^@gluestack-ui/nativewind-utils/withStyleContext$': '<rootDir>/__mocks__/withStyleContextMock.js',

    // локальные UI-обёртки -> наши моки (ИМЕННО ТАКИЕ пути)
    '^@/components/ui/modal(?:/.*)?$':    '<rootDir>/__mocks__/ui/modalMock.js',
    '^@/components/ui/vstack(?:/.*)?$':   '<rootDir>/__mocks__/ui/vstackMock.js',
    '^@/components/ui/text(?:/.*)?$':     '<rootDir>/__mocks__/ui/textMock.js',
    '^@/components/ui/button(?:/.*)?$':   '<rootDir>/__mocks__/ui/buttonMock.js',
    '^@/components/ui/icon(?:/.*)?$':     '<rootDir>/__mocks__/ui/iconMock.js',
    '^@/components/ui/checkbox(?:/.*)?$': '<rootDir>/__mocks__/ui/checkboxMock.js',
    '^@/components/ui/hstack(?:/.*)?$': '<rootDir>/__mocks__/ui/hstackMock.js',
    '^lucide-react-native$': '<rootDir>/__mocks__/lucideReactNativeMock.js',

    // универсальный фолбэк для ЛЮБЫХ остальных @/components/ui/**
    '^@/components/ui/.+$': '<rootDir>/__mocks__/ui/anyUiMock.js',

    // общее правило — В САМОМ КОНЦЕ
    '^@/(.*)$': '<rootDir>/src/$1',

    // ассеты
    '\\.(svg)$': '<rootDir>/__mocks__/fileMock.js',
    '\\.(css|pcss|postcss|scss|sass|less)$': '<rootDir>/__mocks__/styleMock.js',
  },

  // только наш setup — RN мок подменится до любых импортов
  //setupFiles: ['<rootDir>/jest.setup.ts'],

  transform: { '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest' },
  verbose: true,

  // по желанию:
  // clearMocks: true,
  // resetMocks: true,
};


