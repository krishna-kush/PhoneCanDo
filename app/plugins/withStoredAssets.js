const { withAppBuildGradle } = require('@expo/config-plugins');
const { append, block, strip } = require('./gradleBlock');

// Assets that are compressed already stay stored in the APK: the baked
// Default env image (assets/default-image/rootfs.tar.xz, from
// app/modules/phonecando-linux). AGP decides compression from the APP
// module's list, so the library's own noCompress never reaches the APK;
// deflating an xz again saves nothing and costs inflate time on every read.
const GRADLE_BLOCK = block(
  'stored assets',
  '',
  `android {
    androidResources {
        noCompress 'xz'
    }
}
`,
);

module.exports = function withStoredAssets(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = append(strip(cfg.modResults.contents, 'stored assets'), GRADLE_BLOCK);
    return cfg;
  });
};
