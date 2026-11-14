// The chords, all in A minor: the bass's root, and the pad's voicing kept
// close so one chord walks into the next.

export type Chord = {
  name: string;
  /** The bass's note (MIDI). */
  root: number;
  /** The pad's notes (MIDI), lowest first. */
  tones: readonly number[];
  /** Its third is major. */
  major: boolean;
};

export const CHORDS = {
  Am: { name: 'Am', root: 45, tones: [57, 60, 64], major: false },
  F: { name: 'F', root: 41, tones: [57, 60, 65], major: true },
  C: { name: 'C', root: 48, tones: [55, 60, 64], major: true },
  G: { name: 'G', root: 43, tones: [55, 59, 62], major: true },
  Em: { name: 'Em', root: 40, tones: [55, 59, 64], major: false },
  E: { name: 'E', root: 40, tones: [56, 59, 64], major: true },
  Cadd9: { name: 'Cadd9', root: 48, tones: [55, 60, 62, 64], major: true },
} as const satisfies Record<string, Chord>;

/** A bar a chord. The hook rides MAIN (hook.ts). */
export const MAIN: readonly Chord[] = [CHORDS.Am, CHORDS.F, CHORDS.C, CHORDS.G];

/** Night and the held breath after it, the same key turned darker. */
export const NIGHT: readonly Chord[] = [CHORDS.F, CHORDS.G, CHORDS.Em, CHORDS.Am];

/** The climb back sits on E major, the chord that pulls hardest home to Am. */
export const LIFT: readonly Chord[] = [CHORDS.E];

/** The landing rings out on C, Am's bright relative, with a ninth for warmth. */
export const OUTRO: readonly Chord[] = [CHORDS.Cadd9];

/** A chord's relative major: itself if it is major, else the major a minor third up (Am to C, Em to G). */
export const brightOf = (c: Chord): Chord => (c.major ? c : c.name === 'Em' ? CHORDS.G : CHORDS.C);
