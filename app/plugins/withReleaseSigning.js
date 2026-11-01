const { withAppBuildGradle } = require('@expo/config-plugins');

// Release builds must carry the permanent key: Android only installs an
// update signed by the same key as the installed app. Debug builds keep the
// debug keystore, so `expo run:android` needs no secrets.
const MARKER = '// phonecando: release signing';

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(MARKER)) return cfg;
    let contents = cfg.modResults.contents;

    // Repoint the release build type first, while the only `release {` in the
    // file is that block (adding signingConfigs.release earlier would make the
    // first match the signing config instead).
    const beforeRelease = contents;
    contents = contents.replace(
      /(release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig signingConfigs.release',
    );
    if (contents === beforeRelease) {
      throw new Error('withReleaseSigning: release build type not found in app/build.gradle');
    }

    const beforeConfigs = contents;
    contents = contents.replace(
      /signingConfigs\s*\{/,
      `${MARKER}
    def releaseStore = System.getenv("PHONECANDO_STORE_FILE")
    if (releaseStore == null) throw new GradleException("Set PHONECANDO_STORE_FILE to the release keystore")
    signingConfigs {
        release {
            storeFile file(releaseStore)
            storePassword System.getenv("PHONECANDO_STORE_PASSWORD")
            keyAlias System.getenv("PHONECANDO_KEY_ALIAS") ?: "phonecando"
            keyPassword System.getenv("PHONECANDO_KEY_PASSWORD")
        }`,
    );
    if (contents === beforeConfigs) {
      throw new Error('withReleaseSigning: signingConfigs block not found in app/build.gradle');
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
};
