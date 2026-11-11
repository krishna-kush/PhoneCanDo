const { withSettingsGradle } = require('@expo/config-plugins');
const { append, block, strip } = require('./gradleBlock');

// Build our shared network code (network/: HTTP with our redirect and error
// rules, resumable verified downloads, retries) from source. Pure JVM, every
// flavor: lme and lre build on it, and the models and linux modules use its
// retry module directly. Included before the engines that need it.
const GRADLE_BLOCK = block(
  'build the shared network code from source',
  '',
  `includeBuild('../../network') {
  dependencySubstitution {
    substitute module('com.phonecando.network:network-http') using project(':http')
    substitute module('com.phonecando.network:network-download') using project(':download')
    substitute module('com.phonecando.network:network-retry') using project(':retry')
  }
}
`,
);

module.exports = function withNetworkCompositeBuild(config) {
  return withSettingsGradle(config, (cfg) => {
    cfg.modResults.contents = append(strip(cfg.modResults.contents, 'build the shared network code from source'), GRADLE_BLOCK);
    return cfg;
  });
};
