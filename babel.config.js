const {readMapKitApiKey} = require('./scripts/mapkit-env.cjs');

function inlineMapKitKey({types}) {
  return {
    visitor: {
      MemberExpression(path, state) {
        if (path.matchesPattern('process.env.YAMAP_API_KEY')) {
          path.replaceWith(types.stringLiteral(state.opts.apiKey));
        }
      },
    },
  };
}

module.exports = function (api) {
  const isTest = api.env('test');
  api.cache(true);

  return {
    presets: ['module:@react-native/babel-preset'],
    // Framework internals (LogBox, Pressable, nested Text) must keep React's
    // own JSX runtime. NativeWind's wrappers can swallow their callback styles.
    overrides: !isTest
      ? [
          {
            exclude: /[\\/]node_modules[\\/]react-native[\\/]/,
            presets: ['nativewind/babel'],
          },
        ]
      : [],
    plugins: [
      [
        inlineMapKitKey,
        {apiKey: isTest ? 'test-mapkit-api-key' : readMapKitApiKey()},
      ],
      [
        'transform-inline-environment-variables',
        {
          include: ['JACO_LARAVEL_API', 'JACO_OFFLINE_MAP_ERROR_PREVIEW'],
        },
      ],
      ['module-resolver', {root: ['./src'], alias: {'@': './src'}}],
      '@babel/plugin-transform-class-static-block',
      'react-native-worklets/plugin',
    ],
    env: {
      production: {plugins: ['transform-remove-console']},
    },
  };
};
