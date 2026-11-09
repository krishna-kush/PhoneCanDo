const { withSettingsGradle } = require('@expo/config-plugins');
const { append, block, strip } = require('./gradleBlock');

// Build the agent integrations (agents/: the kit, every kind, builtin) from
// source. app/modules/phonecando-runner depends on these coordinates in every
// flavor (pure JVM code). Only the kit and builtin are substituted: the
// runner never names a kind, so adding one needs no line here.
const GRADLE_BLOCK = block(
  'build the agent integrations from source',
  '',
  `includeBuild('../../agents') {
  dependencySubstitution {
    substitute module('com.phonecando.agents:agents-kit-api') using project(':kit-api')
    substitute module('com.phonecando.agents:agents-kit-manifest') using project(':kit-manifest')
    substitute module('com.phonecando.agents:agents-kit-render') using project(':kit-render')
    substitute module('com.phonecando.agents:agents-kit-term') using project(':kit-term')
    substitute module('com.phonecando.agents:agents-builtin') using project(':builtin')
  }
}
`,
);

module.exports = function withAgentsCompositeBuild(config) {
  return withSettingsGradle(config, (cfg) => {
    cfg.modResults.contents = append(strip(cfg.modResults.contents, 'build the agent integrations from source'), GRADLE_BLOCK);
    return cfg;
  });
};
