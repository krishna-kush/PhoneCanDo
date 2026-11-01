const { withAndroidManifest, withGradleProperties } = require('@expo/config-plugins');

// One codebase, two APKs: the automation driver (a11y service +
// BIND_ACCESSIBILITY_SERVICE) ships only in `full` builds. Play builds set
// PHONECANDO_AUTOMATION=play at prebuild time; the driver component + permission
// are stripped and a manifest meta-data flag records the flavor for JS gates.
// Default is full (dev loop unchanged). Full builds declare the gated service;
// play builds strip the component, its Java, and its res (see module build.gradle).
const OUR_AUTOMATION_SERVICE = 'com.phonecando.runner.uiauto.PhoneCanDoAccessibilityService';

module.exports = function withAutomationFlag(config) {
  const mode = process.env.PHONECANDO_AUTOMATION === 'play' ? 'play' : 'full';
  // Gradle property, not env: a reused Gradle daemon keeps the env of the
  // client that started it, so System.getenv() can be stale on the next build.
  config = withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((i) => i.key !== 'phonecando.automation');
    cfg.modResults.push({ type: 'property', key: 'phonecando.automation', value: mode });
    return cfg;
  });
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const app = manifest.application && manifest.application[0];
    if (app) {
      app['meta-data'] = app['meta-data'] || [];
      const meta = app['meta-data'];
      const existing = meta.find((m) => m.$ && m.$['android:name'] === 'com.phonecando.automation');
      if (existing) existing.$['android:value'] = mode;
      else meta.push({ $: { 'android:name': 'com.phonecando.automation', 'android:value': mode } });
    }
    if (mode === 'full' && app) {
      // Declared here (not in the module manifest) so play builds have no
      // service component at all; the driver's Java/res are excluded by the
      // module's sourceSets when PHONECANDO_AUTOMATION=play.
      app.service = app.service || [];
      if (!app.service.some((s) => s.$ && s.$['android:name'] === OUR_AUTOMATION_SERVICE)) {
        app.service.push({
          $: {
            'android:name': OUR_AUTOMATION_SERVICE,
            'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
            'android:exported': 'true',
          },
          'intent-filter': [
            { action: [{ $: { 'android:name': 'android.accessibilityservice.AccessibilityService' } }] },
          ],
          'meta-data': [
            {
              $: {
                'android:name': 'android.accessibilityservice',
                'android:resource': '@xml/accessibility_config',
              },
            },
          ],
        });
      }
    }
    if (mode === 'play') {
      // Never touch other components: only our automation driver.
      if (Array.isArray(manifest['uses-permission'])) {
        manifest['uses-permission'] = manifest['uses-permission'].filter(
          (p) => !(p.$ && p.$['android:name'] === 'android.permission.BIND_ACCESSIBILITY_SERVICE'),
        );
      }
      if (app && Array.isArray(app.service)) {
        app.service = app.service.filter((s) => {
          const name = s.$ && s.$['android:name'];
          return !(name === OUR_AUTOMATION_SERVICE || (name && name.startsWith('com.phonecando.runner.uiauto.')));
        });
      }
    }
    return config;
  });
};
