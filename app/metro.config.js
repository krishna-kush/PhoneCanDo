const { getDefaultConfig } = require('expo/metro-config');
const { withTamagui } = require('@tamagui/cli/metro');
const path = require('node:path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Bundled from <repo>/theme/ (the web reads the same tokens), which sits
// outside the app root — Metro only resolves files inside a watch folder.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, '..')];

// Bundle the xterm terminal page + its JS/CSS as file assets for offline use.
config.resolver.assetExts.push('html');

// Tamagui's compiler (v3 dropped its Babel plugin for this Metro wrapper).
// It runs the components in Node first; Popper's native build imports
// react-dom's flushSync, which only runs on press and which pnpm does not
// hoist to the app's node_modules, so evaluation skips it.
module.exports = withTamagui(config, {
  components: ['tamagui'],
  config: './tamagui.config.ts',
  dangerouslyIgnoreStaticEvaluationModules: ['react-dom'],
});
