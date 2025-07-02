/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */

const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    assetExts: [...defaultConfig.resolver.assetExts, 'db', 'mp3', 'ttf', 'obj', 'png', 'jpg'],
    blockList: [
      /greedandgrossnextlevel\/.*/,
      /greedandgrossnextlevel\.app\/.*/,
      /greedandgrossnextlevel_backup_20250701_202656\/.*/,
    ],
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(defaultConfig, config);
