// The film's two themes, which argue as the film does. The narrator's is
// low, slow and pompous: it climbs a fifth, steps back down and is left
// hanging on B, because the crew always cuts him off; only at dawn does it
// get its C. The crew's hook is high, quick and short, four bars over
// Am, F, C and G; before the drop it is heard a note at a time, one for
// each thing on screen. Pure data: notes are MIDI numbers (A4 = 69).

/** A note of the narrator's theme: its beat from the theme's start, its MIDI note and how many beats it holds. */
export type Phrase = readonly (readonly [at: number, midi: number, len: number])[];

/** At night, in A minor: A2, E3, D3, C3, and B2 left hanging. */
export const NARRATOR: Phrase = [
  [0, 45, 1],
  [1, 52, 1],
  [2, 50, 0.5],
  [2.5, 48, 0.5],
  [3, 47, 1],
];

/** The beat of the theme its hanging note starts on: cut here, it stops on C3. */
export const HANG = 3;

/** The note it hangs on, and the one that resolves it at last: B2, then C3. */
export const RESOLVE = [47, 48] as const;

/** The same climb and fall in C major, whole and home: C3, G3, F3, E3, D3, C3. */
export const HOME = [48, 55, 53, 52, 50, 48] as const;

/** A note of the hook: its 16th in the bar (0 to 15) and its MIDI note. */
export type Cell = readonly [step: number, midi: number];

/** The hook, a bar a chord. */
export const HOOK = {
  Am: [[0, 69], [2, 72], [4, 76], [7, 76], [8, 81], [10, 79], [12, 76]],
  F: [[0, 69], [2, 72], [4, 77], [7, 77], [8, 81], [10, 79], [12, 77]],
  C: [[0, 67], [2, 72], [4, 76], [7, 76], [8, 84], [10, 81], [12, 79], [14, 76]],
  G: [[0, 67], [2, 71], [4, 74], [7, 74], [8, 79], [10, 76], [12, 74]],
} as const satisfies Record<string, readonly Cell[]>;

export type Bar = keyof typeof HOOK;

/** The hook's bars in order. */
export const BARS: readonly Bar[] = ['Am', 'F', 'C', 'G'];

/** How many of a bar's first notes make its opening cell: the three that climb the chord. */
export const OPENING = 3;

/** The lamps, one note each: the notes the hook's Am bar climbs through, A4 C5 E5 A5. Lights out plays them back down. */
export const LAMPS = [69, 72, 76, 81] as const;

/** The crew popping out, one note each: A minor pentatonic from A3 up to D6. */
export const POPS = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84, 86] as const;

/** The pile-up at the gate, one note a bonk: down by semitones from the hook's E5 to the A4 its next bar starts on. */
export const STUMBLE = [76, 75, 74, 73, 72, 71, 70, 69] as const;

/** A minor's scale as semitones above A, for the lines that walk by step. */
export const MINOR = [0, 2, 3, 5, 7, 8, 10] as const;

/** A minor's pentatonic as semitones above A, for the lines that twinkle. */
export const PENTATONIC = [0, 3, 5, 7, 10] as const;

/** The [k]th note of [scale] counted up from [root], running on through the octaves. */
export const degree = (scale: readonly number[], root: number, k: number) => root + 12 * Math.floor(k / scale.length) + scale[((k % scale.length) + scale.length) % scale.length];
