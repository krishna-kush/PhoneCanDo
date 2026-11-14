// The clock on the narrator's strip: the night passing, from two minutes
// to midnight to seven in the morning. It runs slowly while he talks and
// spins through the small hours while the crew plays. Pure.

import { keys, type Key } from '../../../engine/motion/keys.ts';
import { START } from '../beats.ts';
import { MOMENTS } from './moments.ts';

/** Minutes since midnight at each beat; before midnight is negative. */
const TRACK: readonly Key[] = [
  [START.lights, -2],
  [START.crew, 0],
  [START.tools, 48],
  [START.gate, 95],
  [START.chores, 140],
  [START.song, 185],
  [MOMENTS.song.drop, 190],
  [START.dawn, 419],
  [MOMENTS.dawn.card - 0.01, 419.9],
  [MOMENTS.dawn.card, 420],
  [START.end, 421],
];

/** What the clock shows at [beat]: "23:58". */
export function clockAt(beat: number): string {
  const minutes = Math.floor(keys(beat, TRACK));
  const day = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(day / 60)).padStart(2, '0')}:${String(day % 60).padStart(2, '0')}`;
}
