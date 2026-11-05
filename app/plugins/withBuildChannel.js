const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withGradleProperties,
} = require('@expo/config-plugins');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { block, insertAfter, strip, stripLegacy } = require('./gradleBlock');

// One codebase, three channels, one Gradle project. Channels are product
// flavors on the "channel" dimension:
//   full  = phone control (a11y + PCE) + GitHub self-update
//   lite  = no phone control + GitHub self-update (versionCode pinned to 1)
//   play  = no phone control + Play-managed updates (later feature)
//
// Library modules without the dimension (React Native, Expo, Reanimated, the
// terminal) compile once and are shared by every flavor; only the app module
// and phonecando-runner (which declares the same dimension) differ. The
// manifest meta-data `com.phonecando.channel` is the runtime source of truth
// (filled from a manifest placeholder per flavor). The accessibility service
// lives in the full flavor's manifest overlay; play's overlay drops the
// install-packages permission.
const CHANNELS = ['full', 'lite', 'play'];
const LEGACY_MARKER = '// phonecando: channels';
const SERVICE_PREFIX = 'com.phonecando.runner.uiauto.';
const OUR_SERVICE = `${SERVICE_PREFIX}PhoneCanDoAccessibilityService`;

const FULL_MANIFEST = `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application>
    <service
      android:name="${OUR_SERVICE}"
      android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
      android:exported="true">
      <intent-filter>
        <action android:name="android.accessibilityservice.AccessibilityService" />
      </intent-filter>
      <meta-data
        android:name="android.accessibilityservice"
        android:resource="@xml/accessibility_config" />
    </service>
  </application>
</manifest>
`;

const PLAY_MANIFEST = `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
  xmlns:tools="http://schemas.android.com/tools">
  <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" tools:node="remove" />
</manifest>
`;

const FLAVORS = block(
  'channels',
  '    ',
  `    flavorDimensions += ["channel"]
    productFlavors {
        full {
            dimension "channel"
            manifestPlaceholders = [phonecandoChannel: "full"]
        }
        lite {
            dimension "channel"
            manifestPlaceholders = [phonecandoChannel: "lite"]
            // Lite installs full as an update: its code must stay below every
            // full release, and no lite may ever replace an installed full.
            versionCode 1
        }
        play {
            dimension "channel"
            manifestPlaceholders = [phonecandoChannel: "play"]
        }
    }
`,
);

// React Native embeds the JS bundle in every variant not listed here, and its
// default list names build types (debug, debugOptimized), not the flavored
// variants. Without this, debug APKs carry a production bundle (__DEV__
// false) that runs whenever Metro is unreachable. debugOptimized is the build
// type React Native 0.86's Gradle plugin adds next to debug.
const DEBUGGABLE = block(
  'debuggable variants',
  '    ',
  `    debuggableVariants = [${CHANNELS.flatMap((ch) => [`"${ch}Debug"`, `"${ch}DebugOptimized"`]).join(', ')}]\n`,
);

module.exports = function withBuildChannel(config) {
  // Pre-flavor layouts baked the channel into gradle.properties; drop it.
  config = withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter(
      (i) => !(i.type === 'property' && (i.key === 'phonecando.channel' || i.key === 'phonecando.automation')),
    );
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    let contents = stripLegacy(cfg.modResults.contents, LEGACY_MARKER, /productFlavors\s*\{/);
    contents = strip(strip(contents, 'channels'), 'debuggable variants');
    // After defaultConfig's closing brace (the first top-level block inside
    // android {} in the template).
    contents = insertAfter(
      contents,
      /\n    defaultConfig \{[\s\S]*?\n    \}\n/,
      FLAVORS,
      'withBuildChannel: defaultConfig block in app/build.gradle',
    );
    contents = insertAfter(contents, /^react \{\n/m, DEBUGGABLE, 'withBuildChannel: react block in app/build.gradle');
    cfg.modResults.contents = contents;
    return cfg;
  });

  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const app = manifest.application && manifest.application[0];
    if (app) {
      app['meta-data'] = (app['meta-data'] || []).filter(
        (m) =>
          m.$ &&
          m.$['android:name'] !== 'com.phonecando.automation' &&
          m.$['android:name'] !== 'com.phonecando.channel',
      );
      app['meta-data'].push({
        $: { 'android:name': 'com.phonecando.channel', 'android:value': '${phonecandoChannel}' },
      });
      // The service comes from the full flavor overlay only.
      if (Array.isArray(app.service)) {
        app.service = app.service.filter((s) => {
          const name = s.$ && s.$['android:name'];
          return !(name === OUR_SERVICE || (name && name.startsWith(SERVICE_PREFIX)));
        });
      }
    }
    const drop = new Set([
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.BIND_ACCESSIBILITY_SERVICE',
    ]);
    if (Array.isArray(manifest['uses-permission'])) {
      manifest['uses-permission'] = manifest['uses-permission'].filter(
        (p) => !(p.$ && drop.has(p.$['android:name'])),
      );
    }
    return cfg;
  });

  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const src = join(cfg.modRequest.platformProjectRoot, 'app/src');
      for (const ch of CHANNELS) mkdirSync(join(src, ch), { recursive: true });
      writeFileSync(join(src, 'full/AndroidManifest.xml'), FULL_MANIFEST);
      writeFileSync(join(src, 'play/AndroidManifest.xml'), PLAY_MANIFEST);
      return cfg;
    },
  ]);
};

module.exports.CHANNELS = CHANNELS;
