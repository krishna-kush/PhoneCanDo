// Engine seam: the ONLY importer of expo-splash-screen. Android shows the
// launch splash (app/plugins/withSplash.js) before any JS runs; we keep it up
// until the app's first real frame, so a launch never opens on a blank
// window. On an APK built before the module, both calls do nothing.
import * as SplashScreen from 'expo-splash-screen';

/** Keep the splash past React Native's first content. Call once, at module load. */
export function holdSplash(): void {
  SplashScreen.preventAutoHideAsync().catch(() => {
    // already hidden: nothing to hold
  });
}

/** Fade the splash out: the frame under it is ready. Safe to call more than once. */
export function hideSplash(): void {
  SplashScreen.hide();
}
