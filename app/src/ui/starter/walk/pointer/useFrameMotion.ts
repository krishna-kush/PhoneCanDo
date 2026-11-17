import { useEffect, useMemo, useRef } from 'react';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { GLIDE, GLIDE_ACROSS, SNAP } from '../glide';
import type { Rect } from '../logic/frame';

export type FrameMotion = {
  x: SharedValue<number>;
  y: SharedValue<number>;
  width: SharedValue<number>;
  height: SharedValue<number>;
  /** 0 hidden, 1 in place (just past 1 for a moment on the way in). */
  on: SharedValue<number>;
  /** 0 to 1 and back, over and over, while it shows: a slow, small breath. */
  breath: SharedValue<number>;
};

const BREATH = { duration: 1100, easing: Easing.inOut(Easing.sin) };
/** Following its own spot as it shifts: about one read of it (useSpotRect), with no sway. */
const TRACK = { duration: 120, easing: Easing.out(Easing.quad) };

// The pointer's frame as it moves: the first time it shows it lands on the
// spot; from then on it glides from the last spot to the next one, so it
// seems to follow you from tap to tap, and tracks its spot [target] if
// that shifts. While shown it breathes. Still under "Remove animations":
// it sits on the spot, fades in and out, no breath.
export function useFrameMotion(frame: Rect | null, shown: boolean, reduce: boolean, target: string | null): FrameMotion {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const on = useSharedValue(0);
  const breath = useSharedValue(0);
  const placed = useRef(false);
  const lastTarget = useRef<string | null>(null);
  const showing = frame != null && shown;
  const fx = frame?.x ?? 0;
  const fy = frame?.y ?? 0;
  const fw = frame?.width ?? 0;
  const fh = frame?.height ?? 0;

  // Where it is: set at once the first time, then glided or tracked.
  useEffect(() => {
    if (!showing) return;
    if (!placed.current || reduce) {
      x.value = fx;
      y.value = fy;
      width.value = fw;
      height.value = fh;
      placed.current = true;
    } else {
      const same = target === lastTarget.current;
      x.value = withTiming(fx, same ? TRACK : GLIDE_ACROSS);
      y.value = withTiming(fy, same ? TRACK : GLIDE);
      width.value = withTiming(fw, same ? TRACK : GLIDE_ACROSS);
      height.value = withTiming(fh, same ? TRACK : GLIDE);
    }
    lastTarget.current = target;
  }, [showing, fx, fy, fw, fh, reduce, target, x, y, width, height]);

  // Whether it shows: it snaps on and starts breathing as it comes, not on every move.
  useEffect(() => {
    if (!showing) {
      on.value = reduce ? 0 : withTiming(0, { duration: 140 });
      cancelAnimation(breath);
      breath.value = 0;
      return;
    }
    on.value = reduce ? 1 : withTiming(1, SNAP);
    if (!reduce) {
      breath.value = withRepeat(withSequence(withTiming(1, BREATH), withTiming(0, BREATH)), -1);
    }
  }, [showing, reduce, on, breath]);

  // One object for good: its shared values never change, and the looks'
  // animated styles start over whenever what they read is a new object.
  return useMemo(() => ({ x, y, width, height, on, breath }), [x, y, width, height, on, breath]);
}
