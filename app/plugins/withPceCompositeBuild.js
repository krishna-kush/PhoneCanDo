const { withSettingsGradle } = require('@expo/config-plugins');
const { append, block, strip, stripLegacy } = require('./gradleBlock');

// Build the PCE from source instead of resolving stale ~/.m2 artifacts. The
// runner module depends on it only in its full flavor (fullImplementation),
// so lite/play never resolve these coordinates; the composite build is still
// configured because all flavors live in one Gradle project.
const LEGACY_MARKER = '// phonecando: build the PCE from source';

const GRADLE_BLOCK = block(
  'build the PCE from source',
  '',
  `includeBuild('../../pce') {
  dependencySubstitution {
    substitute module('com.phonecando.pce:pce-api') using project(':api')
    substitute module('com.phonecando.pce:pce-core') using project(':core')
    substitute module('com.phonecando.pce:pce-json') using project(':json')
    substitute module('com.phonecando.pce:pce-android') using project(':android')
    substitute module('com.phonecando.pce:pce-pack') using project(':pack')
  }
}
`,
);

module.exports = function withPceCompositeBuild(config) {
  return withSettingsGradle(config, (cfg) => {
    const contents = stripLegacy(cfg.modResults.contents, LEGACY_MARKER, /includeBuild\([^)]*\)\s*\{/);
    cfg.modResults.contents = append(strip(contents, 'build the PCE from source'), GRADLE_BLOCK);
    return cfg;
  });
};
