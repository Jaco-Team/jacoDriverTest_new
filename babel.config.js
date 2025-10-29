// babel.config.js
// module.exports = {
//   presets: [
//     'module:@react-native/babel-preset',
//     'nativewind/babel',     
//   ],
//   plugins: [
//     ['module-resolver', { root: ['./src'], alias: { '@': './src' } }],
//     'react-native-worklets-core/plugin',
//     'react-native-reanimated/plugin',    // этот всегда последним
//   ],
//   env: {
//     production: { plugins: ['transform-remove-console'] },
//   },
// };

// изменил при настройке jest, чтобы в тестах не подключался nativewind
// babel.config.js
// module.exports = function (api) {
//   const isTest = api.env('test');
//   api.cache.using(() => (isTest ? 'test' : process.env.NODE_ENV || 'dev'));

//   return {
//     presets: [
//       'module:@react-native/babel-preset',
//     ],
//     plugins: [
//       ['module-resolver', { root: ['./src'], alias: { '@': './src' } }],

//       // Подключаем NativeWind ТОЛЬКО вне тестов
//       ...(!isTest ? ['nativewind/babel'] : []),

//       // Если используешь worklets-core — оставляем его ПЕРЕД reanimated
//       'react-native-worklets-core/plugin',

//       // ДОЛЖЕН быть последним
//       'react-native-reanimated/plugin',
//     ],
//     env: {
//       production: { plugins: ['transform-remove-console'] },
//     },
//   };
// };

// изменил при настройке jest, чтобы в тестах не подключался nativewind, окончательный вариант, запускается и приложение, и тесты
// babel.config.js
module.exports = function (api) {
  const isTest = api.env('test');      // true внутри Jest
  api.cache(true);

  return {
    presets: [
      'module:@react-native/babel-preset',
      // NativeWind ВКЛЮЧАЕМ только вне тестов
      ...(!isTest ? ['nativewind/babel'] : []),
    ],
    plugins: [
      ['module-resolver', { root: ['./src'], alias: { '@': './src' } }],

      'react-native-worklets-core/plugin',

      // reanimated — строго последним
      'react-native-reanimated/plugin',
    ],
    env: {
      production: { plugins: ['transform-remove-console'] },
    },
  };
};

