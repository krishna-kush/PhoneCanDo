// Every cue's sound on the effects bus: made, brought to its level
// (levels.ts) and laid at its beat with its gain and pan.

import type { Cue } from '../../beats/cue.ts';
import type { Clock } from '../clock.ts';
import { loudest } from '../master/loudness.ts';
import type { Chord } from '../score/chord.ts';
import { seedOf } from '../synth/rand.ts';
import { addStereo, scale, stereo, type Stereo } from '../synth/stereo.ts';
import { SOUNDS } from './index.ts';
import { LEVELS, WINDOW } from './levels.ts';
import type { EffectName } from './names.ts';
import type { EffectArgs } from './types.ts';

/** One effect as a cue asks for it, at its level, before its gain and pan. */
export function made(name: EffectName, args: EffectArgs): Stereo {
  const sound = SOUNDS[name](args);
  const now = loudest(sound, WINDOW);
  return Number.isFinite(now) ? scale(sound, 10 ** ((LEVELS[name] - now) / 20)) : sound;
}

/** The effects bus, [n] samples long: [cues] in time order, each tuned to the chord [chordAt] its beat. */
export function placeEffects(clock: Clock, cues: readonly Cue<EffectName>[], chordAt: (beat: number) => Chord, n: number): Stereo {
  const bus = stereo(n);
  const count = new Map<EffectName, number>();
  for (const c of [...cues].sort((a, b) => a.at - b.at)) {
    const nth = count.get(c.sound) ?? 0;
    count.set(c.sound, nth + 1);
    const sound = made(c.sound, {
      pitch: c.pitch ?? 0,
      len: clock.secondsOf(c.len ?? 1),
      seed: c.seed ?? 0,
      nth,
      noise: seedOf(c.sound, nth, c.at),
      chord: chordAt(c.at),
    });
    addStereo(bus, sound, clock.sampleOf(c.at), c.gain ?? 1, c.pan ?? 0);
  }
  return bus;
}
