// A note as the score writes it, before it is sound: when, on which
// track, which pitch, how long and how hard, all in beats. Every section
// makes its notes first and the band plays them after (band.ts), so a test
// can read the music without rendering it.

import type { TrackId } from './tracks.ts';

export type Note = {
  /** In beats from the film's start. */
  at: number;
  track: TrackId;
  /** The pitch (MIDI); on the drum tracks, which drum (kit.ts). */
  midi: number;
  /** In beats. */
  len: number;
  /** How hard it is played, 0 to 1 and a little over. */
  vel: number;
  /** The pitch it slides in from, for the voices that slide. */
  from?: number;
  /** -1 left to 1 right; the middle when left out. */
  pan?: number;
};

export const note = (track: TrackId, at: number, midi: number, len: number, vel: number, more: Pick<Note, 'from' | 'pan'> = {}): Note => ({ at, track, midi, len, vel, ...more });

/** A chord struck at once: one note a tone. */
export const chord = (track: TrackId, at: number, tones: readonly number[], len: number, vel: number): Note[] => tones.map((midi) => note(track, at, midi, len, vel));

/** Every beat on the film's grid of [step] beats in [from, to). */
export function grid(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let k = Math.ceil(from / step - 1e-9); k * step < to - 1e-9; k++) out.push(k * step);
  return out;
}

/** Where [beat] falls in its bar of four, in 16ths: 0 to 15. */
export const posOf = (beat: number) => ((Math.round(beat * 4) % 16) + 16) % 16;

/** The bar line at or after [beat]. */
export const barAfter = (beat: number) => Math.ceil(beat / 4 - 1e-9) * 4;

/** [x] kept between [lo] and [hi]. */
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
