const { withAppBuildGradle } = require('@expo/config-plugins');
const { append, block, strip } = require('./gradleBlock');

// Assets whose names start with a dot reach the APK: an agent kind's config
// can hold one (Cursor CLI's `.cursor-plugin/plugin.json`), and AGP's default
// pattern drops every `.*` name. The rest of the default stays (VCS folders,
// editor and OS litter, `_` directories). The APK audit checks each kind's
// required config files are packaged.
const PATTERN = '!.svn:!.git:!.ds_store:!*.scc:<dir>_*:!CVS:!thumbs.db:!picasa.ini:!*~';

const GRADLE_BLOCK = block(
  'dot assets',
  '',
  `android {
    androidResources {
        ignoreAssetsPattern = '${PATTERN}'
    }
}
`,
);

module.exports = function withDotAssets(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = append(strip(cfg.modResults.contents, 'dot assets'), GRADLE_BLOCK);
    return cfg;
  });
};
