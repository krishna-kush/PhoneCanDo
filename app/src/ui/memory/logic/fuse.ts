// The countdown's fuse: a row of short segments that burn down as the
// countdown runs, from however much was left when you looked. Pure (zero
// RN imports).

export const FUSE_SEGMENTS = 24;

/** How many segments are still lit with `seconds` of `total` left; all of them without a total. */
export function fuseLit(seconds: number, total: number, segments = FUSE_SEGMENTS): number {
  if (!(total > 0)) return segments;
  return Math.min(segments, Math.max(0, Math.ceil((seconds / total) * segments)));
}
