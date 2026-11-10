const { withSettingsGradle } = require('@expo/config-plugins');
const { append, block, strip } = require('./gradleBlock');

// Build the local model engine (lme/: the Hugging Face catalog, the models
// store, the llama-server launch plan) from source. Pure JVM, every flavor:
// app/modules/phonecando-models depends on these coordinates, and the
// runner's model slot on lme-api, lme-store and lme-host.
const GRADLE_BLOCK = block(
  'build the local model engine from source',
  '',
  `includeBuild('../../lme') {
  dependencySubstitution {
    substitute module('com.phonecando.lme:lme-api') using project(':api')
    substitute module('com.phonecando.lme:lme-gguf') using project(':gguf')
    substitute module('com.phonecando.lme:lme-catalog') using project(':catalog')
    substitute module('com.phonecando.lme:lme-store') using project(':store')
    substitute module('com.phonecando.lme:lme-host') using project(':host')
  }
}
`,
);

module.exports = function withLmeCompositeBuild(config) {
  return withSettingsGradle(config, (cfg) => {
    cfg.modResults.contents = append(strip(cfg.modResults.contents, 'build the local model engine from source'), GRADLE_BLOCK);
    return cfg;
  });
};
