const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const panchangTsPath = path.resolve(__dirname, '../panchang-ts');

// Tell Metro to watch the linked package directory
config.watchFolders = [panchangTsPath];

// Tell Metro where to find node_modules for the linked package
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(panchangTsPath, 'node_modules'),
];

// astronomy-engine is bundled inside panchang-ts/dist/ — block Metro from
// resolving it separately from panchang-ts's own node_modules.
config.resolver.blockList = [
  new RegExp(
    path.resolve(panchangTsPath, 'node_modules').replace(/[/\\]/g, '[/\\\\]') + '/.*',
  ),
];

module.exports = config;
