const { withProjectBuildGradle } = require('@expo/config-plugins');
const { block, insertBeforeLine, strip } = require('./gradleBlock');

// The engine payload is built for API 29 (ANDROID_API in
// scripts/agents/oc/build.sh), so below Android 10 the app
// cannot run its engine, and its native code calls API 26+ APIs unguarded.
// Expo's root plugin sets ext.minSdkVersion only when the root project has
// none (ExpoRootProjectPlugin setIfNotExist), so defining it before
// `apply plugin: "expo-root-project"` wins for the app and every library that
// reads rootProject.ext.minSdkVersion.
const MIN_SDK = 29;

const GRADLE_BLOCK = block('min sdk', '', `ext.minSdkVersion = ${MIN_SDK}\n`);

module.exports = function withMinSdk(config) {
  return withProjectBuildGradle(config, (cfg) => {
    cfg.modResults.contents = insertBeforeLine(
      strip(cfg.modResults.contents, 'min sdk'),
      /^apply plugin: ["']expo-root-project["']/m,
      GRADLE_BLOCK,
      'withMinSdk: apply plugin "expo-root-project" in android/build.gradle',
    );
    return cfg;
  });
};

module.exports.MIN_SDK = MIN_SDK;
