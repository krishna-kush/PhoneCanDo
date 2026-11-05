const { withGradleProperties } = require('@expo/config-plugins');

// Build-time settings for gradle.properties (prebuild regenerates that file,
// so they live here, not in android/). Sized for the dev machine: 8 cores,
// 9 GB RAM, where a build used to spill into swap. Only arm64 is built; the
// release scripts pass the same architecture explicitly.
const PROPS = {
  'org.gradle.jvmargs': '-Xmx3072m -XX:MaxMetaspaceSize=1024m',
  'org.gradle.parallel': 'true',
  'org.gradle.caching': 'true',
  'org.gradle.workers.max': '6',
  'kotlin.daemon.jvmargs': '-Xmx1536m',
  reactNativeArchitectures: 'arm64-v8a',
};

module.exports = function withBuildPerf(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === 'property' && Object.hasOwn(PROPS, item.key)),
    );
    for (const [key, value] of Object.entries(PROPS)) {
      cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });
};
