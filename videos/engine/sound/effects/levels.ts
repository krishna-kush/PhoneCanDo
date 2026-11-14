// How loud each sound effect lands: the K-weighted loudness of its loudest
// tenth of a second, in LUFS, against music sitting at -15. The drop's hit
// leads, the robot's voice and the stamps are clear over a full groove,
// the clicks and ticks stay under it. A cue's gain is on top.

import type { EffectName } from './names.ts';

export const LEVELS: Record<EffectName, number> = {
  impact: -8,
  slam: -11,
  stamp: -12.5,
  scratch: -11,
  lock: -12,
  denied: -12,
  chirp: -13,
  glitch: -14,
  riser: -14,
  unlock: -14,
  notify: -15,
  boing: -15,
  ding: -15,
  sunrise: -15,
  pop: -17,
  send: -17,
  whoosh: -17,
  land: -17,
  scan: -17,
  tap: -18,
  whip: -18,
  progress: -19,
  paper: -19,
  clock: -19,
  tick: -20,
  card: -20,
  type: -22,
  key: -25,
};

/** The window a sound's loudness is measured over, in seconds. */
export const WINDOW = 0.1;
