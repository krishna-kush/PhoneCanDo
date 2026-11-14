// Every sound effect by its name (names.ts). A name added there fails tsc
// here until it has a sound.

import { paper, riser, whip, whoosh } from './air.ts';
import { boing, land } from './body.ts';
import { impact, slam, stamp } from './hits.ts';
import { denied, lock, scan, unlock } from './lock.ts';
import { glitch, progress, scratch } from './machine.ts';
import type { EffectName } from './names.ts';
import { card, ding, tick } from './reel.ts';
import { clock, sunrise } from './time.ts';
import type { Effect } from './types.ts';
import { key, notify, pop, send, tap, typeKey } from './ui.ts';
import { chirp } from './voice.ts';

export const SOUNDS: Record<EffectName, Effect> = {
  tap,
  key,
  type: typeKey,
  send,
  notify,
  pop,
  boing,
  land,
  chirp,
  whoosh,
  whip,
  impact,
  slam,
  stamp,
  tick,
  ding,
  scratch,
  glitch,
  riser,
  card,
  paper,
  clock,
  sunrise,
  lock,
  denied,
  scan,
  unlock,
  progress,
};
