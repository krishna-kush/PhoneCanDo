// A cue: one sound on the beat line. A film's script places them where its
// picture moves; the picture reads the same list to land its hits, and the
// sound side (engine/sound/) makes each one.

export type Cue<Name extends string = string> = {
  /** In beats. */
  at: number;
  sound: Name;
  /** 0 to 1 and over; 1 when left out. */
  gain?: number;
  /** In semitones; 0 when left out. */
  pitch?: number;
  /** -1 left to 1 right; 0 when left out. */
  pan?: number;
  /** In beats, for the sounds that take a length. */
  len?: number;
  /** Picks among a sound's variations. */
  seed?: number;
};

/** Evenly spaced cues: [n] of them from [from], [step] beats apart. */
export const run = <N extends string>(n: number, from: number, step: number, cue: Omit<Cue<N>, 'at'>): Cue<N>[] =>
  Array.from({ length: n }, (_, i) => ({ ...cue, at: from + i * step }));

/** [cues] moved [by] beats later, in time order. */
export const shift = <N extends string>(cues: readonly Cue<N>[], by: number): Cue<N>[] =>
  cues.map((c) => ({ ...c, at: c.at + by })).sort((a, b) => a.at - b.at);
