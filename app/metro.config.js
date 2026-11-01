const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Bundled from <repo>/theme/ (the web reads the same tokens), which sits
// outside the app root — Metro only resolves files inside a watch folder.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, '..')];

// Bundle the xterm terminal page + its JS/CSS as file assets for offline use.
config.resolver.assetExts.push('html');

module.exports = config;
