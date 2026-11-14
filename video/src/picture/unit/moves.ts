// How a unit moves, as numbers from the time (in beats): hops with their
// crouch and squash, bobbing to the beat, blinks and glances. Pure.

import { hash } from '../../motion/noise.ts';
import { outExpo } from '../../motion/ease.ts';

export type Squash = { lift: number; sx: number; sy: number };

const REST: Squash = { lift: 0, sx: 1, sy: 1 };

/** Settling after a landing: a squash that springs back over half a beat. */
function settle(k: number): Squash {
  const d = Math.exp(-7 * k) * Math.cos(k * Math.PI * 3);
  return { lift: 0, sx: 1 + 0.2 * d, sy: 1 - 0.24 * d };
}

/**
 * A hop leaving the ground at [at] and landing [len] beats later, [height]
 * short sides high at its top: a crouch before, stretched in the air,
 * squashed on landing.
 */
export function hop(t: number, at: number, len: number, height: number, crouch = 0.25): Squash {
  if (t < at - crouch) return REST;
  if (t < at) {
    const c = Math.sin(((t - (at - crouch)) / crouch) * (Math.PI / 2));
    return { lift: 0, sx: 1 + 0.16 * c, sy: 1 - 0.2 * c };
  }
  if (t < at + len) {
    const k = (t - at) / len;
    const speed = Math.abs(1 - 2 * k);
    return { lift: 4 * height * k * (1 - k), sx: 1 - 0.1 * speed, sy: 1 + 0.16 * speed };
  }
  const k = (t - at - len) / 0.5;
  return k < 1.5 ? settle(k) : REST;
}

/** Bobbing to the beat: down on each beat, [height] up between. */
export function bob(beat: number, height = 0.06): Squash {
  const f = beat - Math.floor(beat);
  const down = Math.exp(-9 * f);
  return { lift: height * Math.sin(Math.PI * f), sx: 1 + 0.08 * down, sy: 1 - 0.1 * down };
}

/** Whether its eyes are shut for a blink now: one a few beats, at a seeded moment. */
export function blinking(t: number, seed = 0, every = 3.2): boolean {
  const i = Math.floor(t / every);
  const at = i * every + 0.4 + hash(i, seed) * (every - 1);
  return t >= at && t < at + 0.14;
}

/** Glances: [keys] are [beat, x, y] where it looks next; each look snaps over a tenth of a beat. */
export function glance(t: number, keys: readonly (readonly [number, number, number])[]): [number, number] {
  let j = -1;
  while (j + 1 < keys.length && keys[j + 1][0] <= t) j++;
  if (j < 0) return [0, 0];
  const [at, x, y] = keys[j];
  const [, px, py] = j > 0 ? keys[j - 1] : [0, 0, 0];
  const k = outExpo(Math.min(1, (t - at) / 0.12));
  return [px + (x - px) * k, py + (y - py) * k];
}
