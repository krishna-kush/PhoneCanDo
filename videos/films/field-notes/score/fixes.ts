// The fixes: what the crew plays as it corrects the narrator's caption. A
// zip of four fast plucked notes as the wrong words are struck, then a
// ta-da as the right ones land: the fifth and the octave over a root, the
// hook's own leap. The root climbs A minor a step a shot (A, B, C, D, E),
// and each zip is picked from the chord under it. The workshop's fix is a
// slide whistle on its root instead: down an octave, then back up.

import { GLIDE } from '../../../engine/sound/instruments/voices/whistle.ts';
import { MOMENTS } from '../script/moments.ts';
import { note, type Note } from './notes.ts';

/** A shot's fix: the root its ta-da stands on (MIDI), its zip's four notes, and how hard it is played: each a little bolder than the last. */
export type Fix = { root: number; zip?: readonly [number, number, number, number]; level: number };

export const FIXES = {
  // Am: E G A C, then E5 to A5.
  lights: { root: 69, zip: [64, 67, 69, 72], level: 0.55 },
  // A and E with no third under it: F# A B D, then F#5 to B5, all fourths.
  crew: { root: 71, zip: [66, 69, 71, 74], level: 0.65 },
  // The whistle's octave, C6 down to C5 and back: Am's third.
  tools: { root: 72, level: 0.8 },
  // A major, turning to D under the ta-da: B C# E F#, then A5 to D6.
  gate: { root: 74, zip: [71, 73, 76, 78], level: 0.9 },
  // E major: B E F# G#, then B5 to E6.
  chores: { root: 76, zip: [71, 76, 78, 80], level: 1 },
} as const satisfies Record<string, Fix>;

export type Fixed = keyof typeof FIXES;

/** The gap between a zip's notes, and between the ta-da's two, in beats. */
export const ZIP = 0.125;
export const TA = 0.25;

/** How long the whistle takes to fall as the words are struck, and to rise to the write, in beats: one breath when the write is a beat after the strike. */
export const FALL = 0.5;
export const RISE = 0.5;

/** The ta-da's two notes over [root]: its fifth, then its octave. */
export const tadaOf = (root: number) => [root + 7, root + 12] as const;

/**
 * A shot's fix as notes: the zip starts on its strike, the ta-da's top
 * note lands on its write. The whistle starts falling on the strike, and
 * is blown long enough that its rise reaches the top on the write.
 */
export function fixOf(shot: Fixed): Note[] {
  const { strike, write } = MOMENTS[shot];
  const fix: Fix = FIXES[shot];
  const [fifth, octave] = tadaOf(fix.root);
  if (!fix.zip) {
    const fall = Math.min(FALL, write - RISE - strike);
    return [note('whistle', strike, fix.root, fall, 0.9 * fix.level, { from: octave }), note('whistle', write - RISE, octave, RISE / GLIDE, fix.level, { from: fix.root })];
  }
  const zip = fix.zip.map((midi, k) => note('pizz', strike + k * ZIP, midi, 0.2, (0.6 + 0.1 * k) * fix.level, { pan: -0.3 + 0.2 * k }));
  const tada = (['marimba', 'bell'] as const).flatMap((track) => [note(track, write - TA, fifth, 0.2, 0.75 * fix.level), note(track, write, octave, 1, fix.level)]);
  return [...zip, ...tada];
}
