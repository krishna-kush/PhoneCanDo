// The sound's own clock: the sample rate, and beats from the timeline turned
// into samples.

import { BEAT } from '../timeline/tempo.ts';

export const SR = 48000;

/** A beat on the timeline, as a sample index. */
export const sampleOf = (beat: number) => Math.round(beat * BEAT * SR);

/** Seconds, as a whole number of samples. */
export const samplesOf = (seconds: number) => Math.round(seconds * SR);
