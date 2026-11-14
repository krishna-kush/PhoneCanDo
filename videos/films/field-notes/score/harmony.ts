// The film's harmony: its chords, and where each one starts, taken from
// the picture's moments. Night is A minor; the gate opens into A major and
// comes home by D and E; the build climbs Am, C, D, E; the drop walks Am,
// F, C; dawn turns to C major when the narrator is right, and the end
// closes C, F, G, C on the button. The sections and the tuned effects both
// read the chord at a beat from here.

import type { Chord } from '../../../engine/sound/score/chord.ts';
import { START, TEMPO } from '../beats.ts';
import { MOMENTS } from '../script/moments.ts';

/** The bass's root and the pad's voicing, kept close so one chord walks into the next. */
export const CHORDS = {
  Am: { name: 'Am', root: 45, tones: [57, 60, 64], major: false },
  F: { name: 'F', root: 41, tones: [57, 60, 65], major: true },
  C: { name: 'C', root: 48, tones: [55, 60, 64], major: true },
  G: { name: 'G', root: 43, tones: [55, 59, 62], major: true },
  D: { name: 'D', root: 50, tones: [57, 62, 66], major: true },
  E: { name: 'E', root: 52, tones: [56, 59, 64], major: true },
  Esus4: { name: 'Esus4', root: 52, tones: [57, 59, 64], major: true },
  A: { name: 'A', root: 45, tones: [57, 61, 64], major: true },
} as const satisfies Record<string, Chord>;

/**
 * The night's pad: A and E with no third, so the narrator's hanging B and
 * every note the crew adds sit easy over it. The tunes say it is minor.
 */
export const DRONE = [57, 64, 69] as const;

const m = MOMENTS;
const bar = TEMPO.bar;

/** Each change of chord, in time order. */
export const HARMONY: readonly { at: number; chord: Chord }[] = [
  { at: START.lights, chord: CHORDS.Am },
  // The pile-up lands on F, the chord the hook's next bar would have had.
  { at: m.gate.bonks[m.gate.bonks.length - 1], chord: CHORDS.F },
  { at: m.gate.scan[0], chord: CHORDS.Esus4 },
  { at: (m.gate.scan[0] + m.gate.scan[1]) / 2, chord: CHORDS.E },
  { at: m.gate.armed, chord: CHORDS.A },
  { at: m.gate.write, chord: CHORDS.D },
  { at: m.gate.through, chord: CHORDS.E },
  { at: START.chores, chord: CHORDS.Am },
  { at: m.chores.done[1], chord: CHORDS.C },
  { at: m.chores.done[2], chord: CHORDS.D },
  { at: m.chores.done[3], chord: CHORDS.E },
  { at: m.song.line, chord: CHORDS.Am },
  { at: m.song.drop + bar, chord: CHORDS.F },
  { at: m.song.drop + 2 * bar, chord: CHORDS.C },
  { at: m.song.drop + 3 * bar, chord: CHORDS.G },
  { at: m.dawn.scramble[0], chord: CHORDS.Am },
  { at: m.dawn.right, chord: CHORDS.C },
  { at: m.end.mark, chord: CHORDS.F },
  { at: m.end.button - 1, chord: CHORDS.G },
  { at: m.end.button, chord: CHORDS.C },
];

/** The chord sounding at [beat]. */
export function chordAt(beat: number): Chord {
  let now = HARMONY[0].chord;
  for (const h of HARMONY) if (h.at <= beat + 1e-9) now = h.chord;
  return now;
}
