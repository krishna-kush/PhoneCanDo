const { withSettingsGradle } = require('@expo/config-plugins');
const { append, block, strip } = require('./gradleBlock');

// Build the Linux runtime engine (lre/: tar, registry client, image setup)
// from source. app/modules/phonecando-linux depends on these coordinates in
// every flavor (pure JVM code; play compiles them but refuses every Linux
// path at run time and ships no proot, launcher or image).
const GRADLE_BLOCK = block(
  'build the Linux runtime from source',
  '',
  `includeBuild('../../lre') {
  dependencySubstitution {
    substitute module('com.phonecando.lre:lre-api') using project(':api')
    substitute module('com.phonecando.lre:lre-tar') using project(':tar')
    substitute module('com.phonecando.lre:lre-oci') using project(':oci')
    substitute module('com.phonecando.lre:lre-image') using project(':image')
  }
}
`,
);

module.exports = function withLreCompositeBuild(config) {
  return withSettingsGradle(config, (cfg) => {
    cfg.modResults.contents = append(strip(cfg.modResults.contents, 'build the Linux runtime from source'), GRADLE_BLOCK);
    return cfg;
  });
};
