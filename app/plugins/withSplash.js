const { withAndroidStyles } = require('expo/config-plugins');
const withSplashScreen = require('expo-splash-screen/app.plugin.js').default;
const tokens = require('../../theme/tokens.json');
const withSplashIconFade = require('./withSplashIconFade');

// Android 12 animates the splash icon only for this long and caps it at a
// second; from 13 the animated vector's own length is used.
const ANIMATION_MS = 1000;

// The splash style, written by expo-splash-screen's style mod. A mod added
// earlier runs later, so this one, added before that plugin, sees its style.
function withAnimationDuration(config) {
  return withAndroidStyles(config, (config) => {
    const style = config.modResults.resources.style?.find((s) => s.$.name === 'Theme.App.SplashScreen');
    if (!style) throw new Error('withSplash: Theme.App.SplashScreen is missing');
    style.item = [
      ...style.item.filter((i) => i.$.name !== 'windowSplashScreenAnimationDuration'),
      { $: { name: 'windowSplashScreenAnimationDuration' }, _: String(ANIMATION_MS) },
    ];
    return config;
  });
}

// The launch splash in our palette. Android draws it before any of our code
// runs and picks drawable or drawable-night by the phone's theme, so each
// scheme gets the panel colour the app's first frame paints and the mark,
// waking up as A-01, in its own brand colours (animated vectors drawn by
// scripts/make-logos.mjs, 288dp, the splash icon's whole box). Android plays
// it until the app is ready and cuts it there, and the mascot fades out with
// the splash (withSplashIconFade.js).
module.exports = function withSplash(config) {
  config = withAnimationDuration(config);
  config = withSplashIconFade(config);
  return withSplashScreen(config, {
    backgroundColor: tokens.light.panel,
    drawable: {
      icon: './assets/splash/wake-light.xml',
      darkIcon: './assets/splash/wake.xml',
    },
    dark: {
      backgroundColor: tokens.dark.panel,
    },
  });
};
