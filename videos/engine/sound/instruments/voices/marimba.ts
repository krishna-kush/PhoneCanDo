// A marimba bar under a soft mallet: the note, the bar's own overtone two
// octaves up, a touch of a third partial that fits no scale, and the
// mallet's knock. Low bars ring longer than high ones; all of it dies
// fast. Mono.

import { SR } from '../../rate.ts';
import { Biquad } from '../../synth/biquad.ts';
import { tail } from '../../synth/env.ts';
import { Osc } from '../../synth/osc.ts';
import { hz } from '../../synth/pitch.ts';
import { rand } from '../../synth/rand.ts';

export type Marimba = {
  midi: number;
  /** Seconds before the bar is damped; left to ring when left out. */
  len?: number;
  /** How fast the note dies away, in seconds; by its pitch when left out. */
  decay?: number;
  /** How hard the mallet is, 0 to 1: the knock and the top partial. */
  hard?: number;
  seed?: number;
};

/** A bar's partials: the multiple of the note, its level, and its share of the note's decay. */
const PARTIALS = [
  [1, 1, 1],
  [4, 0.26, 0.35],
  [9.2, 0.08, 0.12],
] as const;

export function marimba({ midi, len, decay, hard = 0.5, seed = 1 }: Marimba): Float32Array {
  const f = hz(midi);
  const ring = decay ?? Math.min(0.45, Math.max(0.08, 0.3 * (262 / f) ** 0.4));
  const whole = ring * 6 + 0.01;
  const damp = 0.03;
  const held = len === undefined ? whole : Math.min(whole, len + damp);
  const n = Math.round(SR * held);
  const out = new Float32Array(n);
  const oscs = PARTIALS.map(() => new Osc());
  const r = rand(seed);
  const knock = new Biquad().set('bp', Math.min(5000, 1200 + f), 1.2);
  const lp = new Biquad().set('lp', 6500, 0.7);
  const fade = Math.round(damp * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (let p = 0; p < PARTIALS.length; p++) {
      const [mul, level, share] = PARTIALS[p];
      if (f * mul > SR * 0.4) continue;
      v += oscs[p].sine(f * mul) * level * (p === 2 ? hard * 2 : 1) * Math.exp(-t / (ring * share));
    }
    v += knock.run(r() * 2 - 1) * Math.exp(-t / 0.003) * 0.5 * hard;
    const attack = t < 0.001 ? t / 0.001 : 1;
    out[i] = lp.run(v) * attack * tail(i, n, fade) * 0.6;
  }
  return out;
}
