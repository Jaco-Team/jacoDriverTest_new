// const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

// const config = {};

// module.exports = mergeConfig(getDefaultConfig(__dirname), config);


const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const exclusionList = require("metro-config/src/defaults/exclusionList");
const { withNativeWind } = require("nativewind/metro");

const config = mergeConfig(getDefaultConfig(__dirname), {
  resolver: {
    blockList: exclusionList([
      /\/android\/\.gradle\/.*/,
      /\/android\/app\/build\/.*/,
      /\/android\/build\/.*/,
      /\/ios\/build\/.*/,
      /\/ios\/DerivedData\/.*/,
      /\/ios\/Pods\/.*/,
    ]),
  },
});

module.exports = withNativeWind(config, { input: "./global.css" });
