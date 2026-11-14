// Every cue's sound on the effects bus: made, brought to its level
// (levels.ts) and laid at its beat with its gain and pan.

import type { Placed } from '../../timeline/cues.ts';
import type { Sfx } from '../../timeline/sfx.ts';
import { BEAT } from '../../timeline/tempo.ts';
import { loudest } from '../mix/loudness.ts';
import { sampleOf } from '../rate.ts';
import { chordAt, type Plan } from '../score/plan.ts';
import { seedOf } from '../synth/rand.ts';
import { addStereo, scale, stereo, type Stereo } from '../synth/stereo.ts';
import { SOUNDS } from './index.ts';
import { LEVELS, WINDOW } from './levels.ts';
import type { SfxArgs } from './types.ts';

/** One effect as a cue asks for it, at its level, before its gain and pan. */
export function made(sfx: Sfx, args: SfxArgs): Stereo {
  const sound = SOUNDS[sfx](args);
  const now = loudest(sound, WINDOW);
  return Number.isFinite(now) ? scale(sound, 10 ** ((LEVELS[sfx] - now) / 20)) : sound;
}

export function placeSfx(cues: readonly Placed[], plan: Plan, n: number): Stereo {
  const bus = stereo(n);
  const count = new Map<Sfx, number>();
  for (const c of cues) {
    const nth = count.get(c.sfx) ?? 0;
    count.set(c.sfx, nth + 1);
    const sound = made(c.sfx, {
      pitch: c.pitch ?? 0,
      len: (c.len ?? 1) * BEAT,
      seed: c.seed ?? 0,
      nth,
      noise: seedOf(c.sfx, nth, c.at),
      chord: chordAt(plan, c.at),
    });
    addStereo(bus, sound, sampleOf(c.at), c.gain ?? 1, c.pan ?? 0);
  }
  return bus;
}
