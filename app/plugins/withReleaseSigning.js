const { withAppBuildGradle } = require('@expo/config-plugins');
const { block, insertBeforeLine, legacySpan, strip } = require('./gradleBlock');

// Release builds must carry the permanent key: Android only installs an
// update signed by the same key as the installed app. Debug builds keep the
// debug keystore, so `expo run:android` needs no secrets.
const LEGACY_MARKER = '// phonecando: release signing';

// Whether a release build runs is read from the scheduled task graph, not
// from the requested task names: `assemble`, `bundle` or an abbreviation
// like `aFR` select release variants without saying "release". Only :app
// tasks count; a debugOptimized build legitimately runs library release
// variants (its matchingFallbacks).
const GRADLE_BLOCK = block(
  'release signing',
  '    ',
  `    // Debug builds (the dev loop) need no secrets: without the env the
    // release config borrows the debug keystore, and the build stops once
    // its task graph holds a release task of this app.
    def releaseStore = System.getenv("PHONECANDO_STORE_FILE")
    if (releaseStore == null) {
        gradle.taskGraph.whenReady { graph ->
            def releaseTask = graph.allTasks.find { it.path.startsWith(":app:") && it.name.contains("Release") }
            if (releaseTask != null) {
                throw new GradleException("Set PHONECANDO_STORE_FILE to the release keystore (\${releaseTask.path} is a release build)")
            }
        }
    }
    signingConfigs {
        release {
            if (releaseStore != null) {
                storeFile file(releaseStore)
                storePassword System.getenv("PHONECANDO_STORE_PASSWORD")
                keyAlias System.getenv("PHONECANDO_KEY_ALIAS") ?: "phonecando"
                keyPassword System.getenv("PHONECANDO_KEY_PASSWORD")
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
    }
`,
);

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = strip(cfg.modResults.contents, 'release signing');

    // The old single-marker block replaced the template's `signingConfigs {`
    // opener and put the release config first inside it: give the opener back.
    const legacy = legacySpan(contents, LEGACY_MARKER, /signingConfigs\s*\{\s*release\s*\{/);
    if (legacy) {
      contents = `${contents.slice(0, legacy.start)}${legacy.indent}signingConfigs {${contents.slice(legacy.end)}`;
    }

    // Repoint the release build type. With our block stripped, the template's
    // build type is the only `release {` before a signingConfig line.
    const repointed = contents.replace(
      /(\brelease\s*\{[^}]*?)signingConfig signingConfigs\.(?:debug|release)\b/,
      '$1signingConfig signingConfigs.release',
    );
    if (!/\brelease\s*\{[^}]*?signingConfig signingConfigs\.release\b/.test(repointed)) {
      throw new Error('withReleaseSigning: release build type not found in app/build.gradle');
    }

    // Our block declares signingConfigs.release ahead of the template's
    // signingConfigs { debug } (Gradle merges both blocks).
    cfg.modResults.contents = insertBeforeLine(
      repointed,
      /^[ \t]*signingConfigs\s*\{/m,
      GRADLE_BLOCK,
      'withReleaseSigning: signingConfigs block in app/build.gradle',
    );
    return cfg;
  });
};
