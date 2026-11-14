// A film's clock as the sound reads it: its tempo, with beats on the
// film's line turned into samples and seconds.

import { secondsOf, type Tempo } from '../beats/tempo.ts';
import { samplesOf } from './rate.ts';

export type Clock = {
  tempo: Tempo;
  /** A beat on the film's line, as a sample index. */
  sampleOf: (beat: number) => number;
  /** [beats] in seconds. */
  secondsOf: (beats: number) => number;
};

export const clockOf = (tempo: Tempo): Clock => ({
  tempo,
  sampleOf: (beat) => samplesOf(secondsOf(tempo, beat)),
  secondsOf: (beats) => secondsOf(tempo, beats),
});
