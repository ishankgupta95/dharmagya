const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Web only: expo-sqlite's web worker imports its wa-sqlite .wasm binary, which
// Metro does not treat as an asset by default. Native bundles never reach it.
config.resolver.assetExts.push('wasm');

module.exports = config;
