// The one clock the picture and the sound share. Everything on the
// timeline is placed in beats; a beat is 26 frames at 60 fps and 13 at 30
// (about 138 a minute, a breath slower than a dance floor's 150), so every
// cut lands on a whole frame.

/** One beat, in seconds. */
export const BEAT = 26 / 60;

export const BPM = 60 / BEAT;

/** Beats to a bar. */
export const BAR = 4;

export const secondsOf = (beats: number) => beats * BEAT;

export const beatsOf = (seconds: number) => seconds / BEAT;
