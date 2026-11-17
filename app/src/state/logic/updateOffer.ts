// Whether the update box opens by itself at launch. The check runs quietly
// in the background on every launch; the box opens only for a build it has
// not offered before, so walking away from it keeps it shut until a newer
// one comes out. A debug build opens it too: its download runs, and only
// its Install says Android won't put the release over a debug signature.
// Lite's offer can be silenced in Settings → Updates. Settings → Updates'
// button opens it any time. Pure.

export type LaunchOffer = {
  /** The newer build's versionCode, or null when nothing newer is out. */
  newer: number | null;
  /** The newest versionCode the box already opened for at a launch (0: none yet). */
  offered: number;
  lite: boolean;
  /** Lite's launch offer turned off in Settings → Updates. */
  muted: boolean;
};

export function offerAtLaunch({ newer, offered, lite, muted }: LaunchOffer): boolean {
  if (newer == null) return false;
  if (lite && muted) return false;
  return newer > offered;
}
