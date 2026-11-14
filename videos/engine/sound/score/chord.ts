// A chord as a score writes it: the bass's root and the pad's voicing.
// The tuned sound effects read the one playing under them.

export type Chord = {
  name: string;
  /** The bass's note (MIDI). */
  root: number;
  /** The pad's notes (MIDI), lowest first. */
  tones: readonly number[];
  /** Its third is major. */
  major: boolean;
};

/** The twelve notes by name, from C. */
const NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * A chord's relative major: itself if it is major, else the major a minor
 * third up (Am to C, Em to G), voiced as close as it can be: the tones on
 * the old root step down a whole tone, the others stay.
 */
export function brightOf(c: Chord): Chord {
  if (c.major) return c;
  const root = c.root + 3;
  const tones = c.tones.map((t) => ((t - c.root) % 12 === 0 ? t - 2 : t)).sort((a, b) => a - b);
  return { name: NOTES[root % 12], root, tones, major: true };
}
