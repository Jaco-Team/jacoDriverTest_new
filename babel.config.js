// babel.config.js
module.exports = {
  presets: [
    'module:@react-native/babel-preset',
    'nativewind/babel',     
  ],
  plugins: [
    ['module-resolver', { root: ['./src'], alias: { '@': './src' } }],
    'react-native-worklets-core/plugin',
    'react-native-reanimated/plugin',    // этот всегда последним
  ],
  env: {
    production: { plugins: ['transform-remove-console'] },
  },
};