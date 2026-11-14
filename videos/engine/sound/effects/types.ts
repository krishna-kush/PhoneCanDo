// What every sound effect is made from: its cue's settings, and the chord
// playing under it so a tuned one fits the music.

import type { Chord } from '../score/chord.ts';
import type { Stereo } from '../synth/stereo.ts';

export type EffectArgs = {
  /** Semitones up (or down). */
  pitch: number;
  /** Seconds, for the sounds that take a length. */
  len: number;
  /** The cue's choice among a sound's variations. */
  seed: number;
  /** Which of its kind this is, in time order: 0, 1, 2… */
  nth: number;
  /** A seed for its noise, its own. */
  noise: number;
  chord: Chord;
};

/** A sound effect, starting at its cue: index 0 is the cue's moment. */
export type Effect = (a: EffectArgs) => Stereo;
