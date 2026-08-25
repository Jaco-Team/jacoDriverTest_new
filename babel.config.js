module.exports = function (api) {
  const isTest = api.env('test');
  api.cache(true);

  return {
    presets: [
      'module:@react-native/babel-preset',
      ...(!isTest ? ['nativewind/babel'] : []),
    ],
    plugins: [
      ['module-resolver', { root: ['./src'], alias: { '@': './src' } }],
      '@babel/plugin-transform-class-static-block',
      'react-native-worklets/plugin',
    ],
    env: {
      production: { plugins: ['transform-remove-console'] },
    },
  };
};
