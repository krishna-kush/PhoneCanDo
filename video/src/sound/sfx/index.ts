// Every sound effect by its timeline name (timeline/sfx.ts). A name added
// there fails tsc here until it has a sound.

import type { Sfx } from '../../timeline/sfx.ts';
import { boing, land } from './body.ts';
import { impact, slam, stamp } from './hits.ts';
import { denied, lock, scan, unlock } from './lock.ts';
import { glitch, progress, scratch } from './machine.ts';
import { card, ding, tick } from './reel.ts';
import { clock, sunrise } from './time.ts';
import type { SfxFn } from './types.ts';
import { key, notify, pop, send, tap, typeKey } from './ui.ts';
import { chirp } from './voice.ts';
import { paper, riser, whip, whoosh } from './air.ts';

export const SOUNDS: Record<Sfx, SfxFn> = {
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
