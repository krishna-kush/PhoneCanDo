// A scene's script: how long it runs, what the music does under it, its
// words, the moments its picture moves on and the sounds that land there.
// Every time is in beats from the scene's start (../beats.ts).

import type { Facts } from '../../../brand/facts/facts.ts';
import type { Cue } from './cue.ts';
import type { Change, Section } from './music.ts';

export type { Facts };

export type Script = {
  id: string;
  beats: number;
  /** The music's section from the scene's first beat. */
  music: Section;
  /** Section changes inside the scene. */
  changes?: readonly Change[];
  sounds: (facts: Facts) => readonly Cue[];
};

/** Evenly spaced cues: [n] of [sound] from [from], [step] beats apart. */
export const run = (n: number, from: number, step: number, cue: Omit<Cue, 'at'>): Cue[] =>
  Array.from({ length: n }, (_, i) => ({ ...cue, at: from + i * step }));
