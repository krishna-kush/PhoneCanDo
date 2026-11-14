// How lit each floor is at a beat, 0 to 1: the bunks' lamps come on one
// by one, the workshop flickers awake with its breaker, the landing and
// the glass light as the crew reaches them, every floor pulses with the
// song, and at dawn they go out top to bottom. Pure.

import { clamp, pulse, seg } from '../../../engine/motion/tween.ts';
import { outCubic } from '../../../engine/motion/ease.ts';
import { hash } from '../../../engine/motion/noise.ts';
import { START } from '../beats.ts';
import { MOMENTS } from '../script/moments.ts';
import type { FloorId } from './plan.ts';

/** How long a lamp takes to come on or go out, in beats. */
const SNAP = 0.18;

const on = (beat: number, at: number) => seg(beat, at, at + SNAP, outCubic);

/** Each floor's lamps going out at dawn. */
const OUT: Record<FloorId, number> = {
  glass: MOMENTS.dawn.out[0],
  landing: MOMENTS.dawn.out[1],
  workshop: MOMENTS.dawn.out[2],
  bunks: MOMENTS.dawn.out[3],
};

function risen(floor: FloorId, beat: number): number {
  switch (floor) {
    case 'bunks':
      return MOMENTS.lights.lamps.reduce((lit, at) => lit + on(beat, at) / MOMENTS.lights.lamps.length, 0);
    case 'workshop': {
      // A tube that catches on the third try.
      const since = beat - MOMENTS.tools.breaker;
      if (since < 0) return 0;
      if (since < 0.5) return hash(Math.floor(since * 16), 3) > 0.45 ? 0.9 : 0.15;
      return 1;
    }
    case 'landing':
      return on(beat, START.gate - 2.5);
    case 'glass':
      return Math.max(on(beat, START.chores - 1.6), 0);
  }
}

/** How lit [floor] is at [beat]. */
export function litAt(floor: FloorId, beat: number): number {
  const dark = seg(beat, OUT[floor], OUT[floor] + SNAP, outCubic);
  let lit = risen(floor, beat) * (1 - dark);
  // The song: every floor's light kicks on the beat.
  if (beat >= MOMENTS.song.drop && beat < MOMENTS.dawn.bell[0]) lit *= 0.78 + 0.22 * pulse(beat - MOMENTS.song.drop, 4);
  // Morning: the glass is lit by the day.
  if (floor === 'glass') lit = Math.max(lit, seg(beat, MOMENTS.dawn.card - 0.5, MOMENTS.dawn.card + 0.5, outCubic));
  return clamp(lit);
}

/** Whether lamp [i] of [n] on a floor is on, given how lit the floor is: they come on left to right. */
export const lampOn = (lit: number, i: number, n: number) => lit > (i + 0.5) / n - 0.01;
