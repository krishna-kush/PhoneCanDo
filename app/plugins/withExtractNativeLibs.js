const { withAndroidManifest, withGradleProperties } = require('@expo/config-plugins');

// Native libs (our engines, proot, llama-server) must be extracted so the
// service can exec them from nativeLibraryDir. Expo defaults this off. AGP 9
// refuses android:extractNativeLibs in the manifest; Expo's app/build.gradle
// passes expo.useLegacyPackaging on to jniLibs.useLegacyPackaging, which
// packs the libs compressed and has them extracted on install.
module.exports = function withExtractNativeLibs(config) {
  config = withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === 'property' && item.key === 'expo.useLegacyPackaging'),
    );
    cfg.modResults.push({ type: 'property', key: 'expo.useLegacyPackaging', value: 'true' });
    return cfg;
  });
  // A prebuild with --no-clean keeps an older manifest's attribute.
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application && cfg.modResults.manifest.application[0];
    if (app && app.$) delete app.$['android:extractNativeLibs'];
    return cfg;
  });
};
