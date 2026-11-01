const { withSettingsGradle } = require('@expo/config-plugins');

// Build the PCE from source instead of resolving stale ~/.m2 artifacts.
// The app keeps published coordinates; Gradle substitutes the included build.
const MARKER = '// phonecando: build the PCE from source';

module.exports = function withPceCompositeBuild(config) {
  return withSettingsGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(MARKER)) return cfg;
    cfg.modResults.contents += `
${MARKER}
includeBuild('../../pce') {
  dependencySubstitution {
    substitute module('com.phonecando.pce:pce-api') using project(':api')
    substitute module('com.phonecando.pce:pce-core') using project(':core')
    substitute module('com.phonecando.pce:pce-json') using project(':json')
    substitute module('com.phonecando.pce:pce-android') using project(':android')
    substitute module('com.phonecando.pce:pce-pack') using project(':pack')
  }
}
`;
    return cfg;
  });
};
