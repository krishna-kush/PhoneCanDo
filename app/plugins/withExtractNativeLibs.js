const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withExtractNativeLibs(config) {
  return withAndroidManifest(config, (config) => {
    const app =
      config.modResults.manifest.application &&
      config.modResults.manifest.application[0];
    if (app && app.$) {
      // Native libs (our opencode engine and renderer) must be extracted so
      // the service can exec them from nativeLibraryDir. Expo defaults this off.
      app.$['android:extractNativeLibs'] = 'true';
    }
    return config;
  });
};
