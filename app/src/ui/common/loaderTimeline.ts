// The logo loader's loop as a function of time, as the website's keyframes
// have it (web/src/lib/logoLoaderCss.ts): each pose holds, then morphs into
// the next; the last pose (equal to the first) holds longer at the seam.
// One clock drives it, so nothing restarts at the seam: a chain of
// withDelay steps under withRepeat began each loop from the previous
// loop's last value and swept back through every pose. Worklets, pure
// (zero RN imports); vectors in scripts/vectors/test_loader.js.

export type LoaderPose = { w: number; h: number; swap: boolean };
export type LoaderTimes = { holdMs: number; morphMs: number; endHoldMs: number };
export type LoaderEase = (t: number) => number;

/** Where the loop is: the shape's pose (fractional while it morphs) and the inks' swap role (0 red in front, 1 amber). */
export type LoaderPhase = { shape: number; role: number };

/** One loop's length: every pose holds, every pose but the last morphs on, and the seam holds a while longer. */
export function loaderLoopMs(poseCount: number, t: LoaderTimes): number {
  'worklet';
  return poseCount * t.holdMs + (poseCount - 1) * t.morphMs + t.endHoldMs;
}

/**
 * The loop at `ms` (any time; it wraps). The shape follows `shapeEase`; the
 * swap shares it while the shape also moves, so the stack flips halfway,
 * and takes the gentler `swapEase` for a colour-only swap.
 */
export function loaderAt(
  ms: number,
  poses: readonly LoaderPose[],
  t: LoaderTimes,
  shapeEase: LoaderEase,
  swapEase: LoaderEase,
): LoaderPhase {
  'worklet';
  const last = poses.length - 1;
  const loop = loaderLoopMs(poses.length, t);
  const at = ((ms % loop) + loop) % loop;
  const step = t.holdMs + t.morphMs;
  const k = Math.floor(at / step);
  if (k >= last) return { shape: last, role: poses[last].swap ? 1 : 0 };
  const from = poses[k];
  const to = poses[k + 1];
  const r0 = from.swap ? 1 : 0;
  const r1 = to.swap ? 1 : 0;
  const into = at - k * step - t.holdMs;
  if (into <= 0) return { shape: k, role: r0 };
  const f = Math.min(1, into / t.morphMs);
  const e = shapeEase(f);
  const morphs = from.w !== to.w || from.h !== to.h;
  return { shape: k + e, role: r0 + (r1 - r0) * (morphs ? e : swapEase(f)) };
}
