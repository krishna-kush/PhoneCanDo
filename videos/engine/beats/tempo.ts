// A film's tempo. Every script, picture and sound is written in beats;
// seconds, frames and bars come from here, so a hit on screen and in the
// mix are the same number.

export type Tempo = {
  bpm: number;
  /** Beats to a bar. */
  bar: number;
  /** One beat, in seconds. */
  beat: number;
};

export const tempoOf = (bpm: number, bar = 4): Tempo => ({ bpm, bar, beat: 60 / bpm });

/** [beats] in seconds. */
export const secondsOf = (t: Tempo, beats: number) => beats * t.beat;

/** [seconds] in beats. */
export const beatsOf = (t: Tempo, seconds: number) => seconds / t.beat;

/** The frame [beats] falls on at [fps]. */
export const frameOf = (t: Tempo, beats: number, fps: number) => Math.round(beats * t.beat * fps);

/** The bar [beat] is in, counted from 0. */
export const barOf = (t: Tempo, beat: number) => Math.floor(beat / t.bar + 1e-9);
