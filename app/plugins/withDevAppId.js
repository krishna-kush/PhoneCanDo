const { withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { CHANNELS } = require('./withBuildChannel');
const { append, block, strip, stripLegacy } = require('./gradleBlock');

// Debug builds install as a separate app per channel (`<package>.lite.dev`
// "PhoneCanDo Lite Dev", `<package>.full.dev` "PhoneCanDo Full Dev") so the
// Metro dev loop for both channels and a release-signed production install
// can sit on the same phone without replacing each other. Release keeps the
// real id for every flavor. Each app has its own data, engine port (service
// picks a free one), bridge port and accessibility service entry.
// scripts/android-dev.mjs launches with the matching `--app-id`.
// debugOptimized is the debug build type React Native 0.86's Gradle plugin
// adds; without it here, those variants would install over the release app.
const DEV_BUILD_TYPES = ['debug', 'debugOptimized'];
const LEGACY_MARKER = '// phonecando: dev app id';

function devName(channel) {
  return `PhoneCanDo ${channel.charAt(0).toUpperCase()}${channel.slice(1)} Dev`;
}

const GRADLE_BLOCK = block(
  'dev app id',
  '',
  `androidComponents {
    onVariants(selector().all()) { variant ->
        if (variant.buildType in [${DEV_BUILD_TYPES.map((t) => `"${t}"`).join(', ')}]) {
            variant.applicationId.set("\${variant.applicationId.get()}.\${variant.flavorName}.dev")
        }
    }
}
`,
);

module.exports = function withDevAppId(config) {
  config = withAppBuildGradle(config, (cfg) => {
    const contents = stripLegacy(cfg.modResults.contents, LEGACY_MARKER, /androidComponents\s*\{/);
    cfg.modResults.contents = append(strip(contents, 'dev app id'), GRADLE_BLOCK);
    return cfg;
  });

  // <flavor><BuildType> resources override main: each dev app shows its own name.
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      for (const channel of CHANNELS) {
        for (const type of DEV_BUILD_TYPES) {
          const variant = `${channel}${type.charAt(0).toUpperCase()}${type.slice(1)}`;
          const dir = join(cfg.modRequest.platformProjectRoot, `app/src/${variant}/res/values`);
          mkdirSync(dir, { recursive: true });
          writeFileSync(
            join(dir, 'strings.xml'),
            `<resources>\n  <string name="app_name">${devName(channel)}</string>\n</resources>\n`,
          );
        }
      }
      return cfg;
    },
  ]);
};
