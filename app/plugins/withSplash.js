const withSplashScreen = require('expo-splash-screen/app.plugin.js').default;
const tokens = require('../../theme/tokens.json');

// The launch splash in our palette. Android draws it before any of our code
// runs and picks values or values-night by the phone's theme, so each scheme
// gets the panel colour the app's first frame paints and a mark in its own
// brand colours (both drawn by scripts/make-logos.mjs). 288dp is the splash
// icon's whole box, so the mark keeps the 36% make-logos drew it at.
module.exports = function withSplash(config) {
  return withSplashScreen(config, {
    image: './assets/splash-icon-light.png',
    backgroundColor: tokens.light.panel,
    imageWidth: 288,
    resizeMode: 'contain',
    dark: {
      image: './assets/splash-icon.png',
      backgroundColor: tokens.dark.panel,
    },
  });
};
