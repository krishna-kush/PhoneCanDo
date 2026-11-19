// The intro's beat line: its tempo and its scenes in running order
// (script/scenes.ts). The picture, the sound and the render commands all
// read it. A beat is 26 frames at 60 fps and 13 at 30 (about 138 a
// minute, a breath slower than a dance floor's 150), so every cut lands
// on a whole frame.

import type { Tempo } from '../../engine/beats/tempo.ts';
import { LINE } from './script/scenes.ts';

/** One beat, in seconds. */
export const BEAT = 26 / 60;

/** Beats to a bar. */
export const BAR = 4;

export const TEMPO: Tempo = { bpm: 60 / BEAT, bar: BAR, beat: BEAT };

export { LINE };
