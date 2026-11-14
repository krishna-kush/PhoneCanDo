// The slot reel and the card table: a woody tick, a bell for a landing, a
// card flicked down.

import { SR } from '../rate.ts';
import { Biquad } from '../synth/biquad.ts';
import { ad } from '../synth/env.ts';
import { Osc } from '../synth/osc.ts';
import { ratio } from '../synth/pitch.ts';
import { rand } from '../synth/rand.ts';
import { dual, stereo } from '../synth/stereo.ts';
import { into, mono } from './sample.ts';
import type { SfxFn } from './types.ts';

/** A woodblock on E6, in the key: a short sine with an inharmonic partial and a click. */
export const tick: SfxFn = ({ pitch, noise }) => {
  const f = 1318.5 * ratio(pitch);
  const r = rand(noise);
  const bp = new Biquad().set('bp', 3000, 1);
  const a = new Osc();
  const b = new Osc();
  return dual(
    mono(0.06, (t) => a.sine(f) * ad(t, 0.0003, 0.012) + b.sine(f * 2.76) * ad(t, 0.0002, 0.006) * 0.4 + bp.run(r() * 2 - 1) * Math.exp(-t / 0.002) * 0.6),
  );
};

/** A struck bell's partials, how loud and how long each rings. */
const PARTIALS = [
  [1, 1, 0.45],
  [2, 0.4, 0.3],
  [2.76, 0.3, 0.2],
  [5.4, 0.12, 0.08],
] as const;

/** A bright bell on E6 over a softer A5: a fifth, in the key. */
export const ding: SfxFn = ({ pitch }) => {
  const k = ratio(pitch);
  const out = stereo(Math.round(1.1 * SR));
  for (const [base, level] of [
    [1318.5, 1],
    [880, 0.35],
  ] as const) {
    const oscs = PARTIALS.map(() => new Osc());
    into(
      out,
      mono(1.1, (t) => {
        let v = 0;
        for (let p = 0; p < PARTIALS.length; p++) {
          const [mul, amp, decay] = PARTIALS[p];
          v += oscs[p].sine(base * k * mul) * amp * ad(t, 0.001, decay);
        }
        return v;
      }, 0.02),
      0,
      level,
    );
  }
  return out;
};

/** A card's snap, its slide across the felt, a soft knock as it stops. */
export const card: SfxFn = ({ pitch, noise }) => {
  const r = rand(noise);
  const hp = new Biquad().set('hp', 3000, 0.7);
  const bp = new Biquad().set('bp', 3200 * ratio(pitch / 2), 1.5);
  const knock = new Osc();
  return dual(
    mono(0.13, (t) => {
      const snap = hp.run(r() * 2 - 1) * Math.exp(-t / 0.003) * 0.8;
      const slide = bp.run(r() * 2 - 1) * ad(t, 0.002, 0.04) * 1.2;
      return snap + slide + knock.sine(300) * Math.exp(-t / 0.01) * 0.2;
    }),
  );
};
