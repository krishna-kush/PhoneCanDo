// A scene's script: how long it runs, what the music does under it, its
// words, the moments its picture moves on and the sounds that land there.
// Every time is in beats from the scene's start (tempo.ts).

import type { Change, Section } from '../music.ts';
import type { Cue } from '../sfx.ts';

/** What the video reads from the repo rather than writes down: src/facts/. */
export type Facts = {
  /** Every agent kind's label, the default kind first. */
  agents: readonly string[];
};

export type Script = {
  id: string;
  beats: number;
  /** The music's section from the scene's first beat. */
  music: Section;
  /** Section changes inside the scene. */
  changes?: readonly Change[];
  sounds: (facts: Facts) => readonly Cue[];
};

/** Evenly spaced cues: [n] of [sfx] from [from], [step] beats apart. */
export const run = (n: number, from: number, step: number, cue: Omit<Cue, 'at'>): Cue[] =>
  Array.from({ length: n }, (_, i) => ({ ...cue, at: from + i * step }));
