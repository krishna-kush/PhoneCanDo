// What a film gives the sound engine: its tempo and length, the cues its
// picture lands on, and its music. The rest is the engine's
// (soundtrack.ts): making and placing the effects at their levels, the
// pump, the echo and the room, ducking the music under the effects, and
// the master.

import type { Cue } from '../beats/cue.ts';
import type { Tempo } from '../beats/tempo.ts';
import type { EffectName } from './effects/names.ts';
import type { Chord } from './score/chord.ts';
import type { Stage } from './score/play.ts';

/** One track of the music, as the mix takes it. */
export type Track = {
  /** How loud it sits: its own integrated loudness once calibrated, in LUFS. */
  loudness: number;
  /** How deep the kick pumps it, 0 to 1; not at all when left out. */
  pump?: number;
  /** Its share sent to the ping-pong echo and to the room; none when left out. */
  echo?: number;
  room?: number;
};

/** A film's music; [T] is its tracks' names. */
export type Music<T extends string = string> = {
  /** The tracks by name. The mix sums them in the order written. */
  tracks: Record<T, Track>;
  /**
   * Plays the score onto the stage's tracks, noting the kicks that pump
   * them. (Written as a method so a score typed by its own track names is
   * still a plain `Music`: the stage always holds exactly `tracks`.)
   */
  play(stage: Stage<T>): void;
  /** Where the music is hard silent, in beats. */
  silences: readonly { from: number; to: number }[];
  /** Where a tape stop winds the music down, from full speed to nothing, in beats. */
  stops: readonly { from: number; to: number }[];
  /** Where the echo and the room are emptied, so no tail crosses a silence, in beats. */
  cuts: readonly number[];
  /** The chord sounding at [beat], for the effects tuned to the music. */
  chordAt: (beat: number) => Chord;
};

export type Sound = {
  tempo: Tempo;
  /** The film's length, in beats. */
  beats: number;
  /** Every sound effect, `at` in beats from the film's start. */
  cues: readonly Cue<EffectName>[];
  music: Music;
  /** Where the master lands, in LUFS and dBTP, when not the engine's own (soundtrack.ts). */
  master?: { loudness?: number; ceiling?: number };
};
