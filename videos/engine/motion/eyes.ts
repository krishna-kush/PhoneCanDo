// What a pair of eyes does along the beat line: blinks at seeded moments
// and glances that snap from one look to the next. Pure.

import { outExpo } from './ease.ts';
import { hash } from './noise.ts';

/** Whether the eyes are shut for a blink now: one every few beats, at a seeded moment. */
export function blinking(t: number, seed = 0, every = 3.2): boolean {
  const i = Math.floor(t / every);
  const at = i * every + 0.4 + hash(i, seed) * (every - 1);
  return t >= at && t < at + 0.14;
}

/** [beat, x, y]: where it looks from that beat on, -1 to 1 each way. */
export type Look = readonly [at: number, x: number, y: number];

/** Where it looks at [t]: each look snaps in over a tenth of a beat. */
export function glance(t: number, looks: readonly Look[]): [number, number] {
  let j = -1;
  while (j + 1 < looks.length && looks[j + 1][0] <= t) j++;
  if (j < 0) return [0, 0];
  const [at, x, y] = looks[j];
  const [, px, py] = j > 0 ? looks[j - 1] : [0, 0, 0];
  const k = outExpo(Math.min(1, (t - at) / 0.12));
  return [px + (x - px) * k, py + (y - py) * k];
}
