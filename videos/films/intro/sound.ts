// The intro's sound: its tempo and length from the beat line, every
// scene's effects where its script places them, and its own score
// (score/), A minor at about 138 a minute.

import { FACTS } from '../../brand/facts/facts.ts';
import type { Sound } from '../../engine/sound/sound.ts';
import { TEMPO } from './beats.ts';
import { scoreOf } from './score/score.ts';
import { soundsOf } from './script/cues.ts';
import { TOTAL } from './script/scenes.ts';

export const sound: Sound = {
  tempo: TEMPO,
  beats: TOTAL,
  cues: soundsOf(FACTS),
  music: scoreOf(),
};
