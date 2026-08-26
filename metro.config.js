// const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

// const config = {};

// module.exports = mergeConfig(getDefaultConfig(__dirname), config);


const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const exclusionList =
  require("metro-config/private/defaults/exclusionList").default;
const { withNativeWind } = require("nativewind/metro");

const {
  withSentryConfig
} = require("@sentry/react-native/metro");

const defaultConfig = getDefaultConfig(__dirname);
const sourceExts = defaultConfig.resolver.sourceExts.includes("mjs")
  ? defaultConfig.resolver.sourceExts
  : [...defaultConfig.resolver.sourceExts, "mjs"];

const config = mergeConfig(defaultConfig, {
  resolver: {
    blockList: exclusionList([
      /\/android\/\.gradle\/.*/,
      /\/android\/app\/build\/.*/,
      /\/android\/build\/.*/,
      /\/ios\/build\/.*/,
      /\/ios\/DerivedData\/.*/,
      /\/ios\/Pods\/.*/,
    ]),
    // lucide-react-native 1.x: поле react-native / exports указывает на .mjs
    sourceExts,
  },
});

module.exports = withSentryConfig(withNativeWind(config, { input: "./global.css" }));