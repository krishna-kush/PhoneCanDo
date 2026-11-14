// A value that changes along the beat line, written as keys: where it is at
// each beat, and how it eases into that key from the one before. Pure.

import { linear, type Ease } from './ease.ts';
import { lerp } from './tween.ts';

/** [beat, value] or [beat, value, ease into this key]. */
export type Key = readonly [at: number, value: number, ease?: Ease];

/** The value at [t]: the first key's before it, the last key's after it, eased between. */
export function keys(t: number, track: readonly Key[]): number {
  if (track.length === 0) return 0;
  if (t <= track[0][0]) return track[0][1];
  for (let i = 1; i < track.length; i++) {
    const [at, value, ease = linear] = track[i];
    if (t < at) {
      const [from, before] = track[i - 1];
      return lerp(before, value, ease(at === from ? 1 : (t - from) / (at - from)));
    }
  }
  return track[track.length - 1][1];
}

/** A place that changes along the beat line: [beat, x, y] or [beat, x, y, ease]. */
export type PlaceKey = readonly [at: number, x: number, y: number, ease?: Ease];

/** The place at [t], each of x and y as keys() has it. */
export function place(t: number, track: readonly PlaceKey[]): { x: number; y: number } {
  return {
    x: keys(t, track.map(([at, x, , ease]) => [at, x, ease] as const)),
    y: keys(t, track.map(([at, , y, ease]) => [at, y, ease] as const)),
  };
}
