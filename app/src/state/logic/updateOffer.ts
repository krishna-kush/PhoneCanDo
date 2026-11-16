// Whether the update box opens by itself at launch. The check runs quietly
// in the background on every launch; the box opens only for a build it has
// not offered before, so walking away from it keeps it shut until a newer
// one comes out. A debug build never opens it (Android won't install the
// release over a debug signature), and lite's offer can be silenced in
// Settings → Updates. Settings → Updates' button opens it any time. Pure.

export type LaunchOffer = {
  /** The newer build's versionCode, or null when nothing newer is out. */
  newer: number | null;
  /** The newest versionCode the box already opened for at a launch (0: none yet). */
  offered: number;
  debug: boolean;
  lite: boolean;
  /** Lite's launch offer turned off in Settings → Updates. */
  muted: boolean;
};

export function offerAtLaunch({ newer, offered, debug, lite, muted }: LaunchOffer): boolean {
  if (newer == null || debug) return false;
  if (lite && muted) return false;
  return newer > offered;
}
