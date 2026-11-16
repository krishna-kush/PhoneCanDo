const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

// A baseline profile: the classes Android compiles ahead of time at install,
// so launch runs compiled code instead of interpreting it. Play makes one
// from its users' runs; our APKs are installed from GitHub and never get
// it, so we ship our own. AGP builds src/main/baseline-prof.txt into the
// APK and androidx.profileinstaller (already a dependency) applies it.
// Whole packages, wildcarded: React Native, Hermes' JNI side, Expo's
// modules core and our own modules all run at launch.
const RULES = [
  'com/facebook/react/**',
  'com/facebook/hermes/**',
  'com/facebook/jni/**',
  'com/facebook/yoga/**',
  'expo/modules/**',
  'com/phonecando/**',
];

const PROFILE = RULES.map((pkg) => `HSPL${pkg.replace(/\*\*$/, '**;->**(**)**')}\nL${pkg.replace(/\*\*$/, '**;')}`).join('\n') + '\n';

module.exports = function withBaselineProfile(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'baseline-prof.txt'), PROFILE);
      return cfg;
    },
  ]);
};
