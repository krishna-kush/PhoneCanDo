// A lock: the latch going home, the buzz of a no, the fingerprint scan and
// the chime when it opens.

import { bell } from '../instruments/voices/bell.ts';
import { SR } from '../rate.ts';
import { Biquad } from '../synth/biquad.ts';
import { ad } from '../synth/env.ts';
import { Osc } from '../synth/osc.ts';
import { ratio } from '../synth/pitch.ts';
import { rand } from '../synth/rand.ts';
import { drive } from '../synth/shape.ts';
import { dual, stereo } from '../synth/stereo.ts';
import { into, mono } from './sample.ts';
import type { Effect } from './types.ts';

/** The clunk's metal: each partial's frequency, level and ring. */
const METAL = [
  [310, 1, 0.09],
  [870, 0.6, 0.06],
  [1480, 0.35, 0.04],
  [2390, 0.2, 0.03],
] as const;

/** A latch: the bolt's slide clicks, then it lands with a metal clunk and a thud. */
export const lock: Effect = ({ pitch, noise }) => {
  const k = ratio(pitch);
  const r = rand(noise);
  const click = new Biquad().set('bp', 3000, 1.5);
  const grit = new Biquad().set('bp', 900, 1);
  const oscs = METAL.map(() => new Osc());
  const thud = new Osc();
  const at = 0.045;
  return dual(
    mono(0.34, (t) => {
      let v = click.run(r() * 2 - 1) * Math.exp(-t / 0.004) * 1.2;
      const c = t - at;
      if (c >= 0) {
        for (let p = 0; p < METAL.length; p++) {
          const [f, amp, ring] = METAL[p];
          v += oscs[p].sine(f * k) * amp * ad(c, 0.0005, ring) * 0.6;
        }
        v += thud.sine((70 + 25 * Math.exp(-c / 0.02)) * k) * ad(c, 0.0005, 0.05);
        v += grit.run(r() * 2 - 1) * Math.exp(-c / 0.02) * 0.8;
      }
      return drive(v, 1.3);
    }),
  );
};

/** Two low buzzes, a semitone grinding against itself. */
export const denied: Effect = ({ pitch }) => {
  const k = ratio(pitch);
  const a = new Osc();
  const b = new Osc(0.3);
  const lp = new Biquad().set('lp', 1600, 0.7);
  const on = (t: number) => {
    for (const [s, e] of [
      [0, 0.12],
      [0.16, 0.28],
    ]) {
      if (t >= s && t < e) return Math.min(1, (t - s) / 0.004, (e - t) / 0.004);
    }
    return 0;
  };
  return dual(mono(0.32, (t) => drive(lp.run(a.pulse(110 * k, 0.5) + b.pulse(116.54 * k, 0.5)) * 0.6, 1.5) * on(t)));
};

/** A sweep climbing under a fast flicker, with a breath of noise following it: a sensor reading. */
export const scan: Effect = ({ pitch, len, noise }) => {
  const k = ratio(pitch);
  const r = rand(noise);
  const low = new Osc();
  const fifth = new Osc();
  const bp = new Biquad();
  return dual(
    mono(
      len,
      (t, i) => {
        const u = Math.min(1, t / len);
        const f = 500 * (1800 / 500) ** u * k;
        if ((i & 31) === 0) bp.set('bp', f * 2, 2);
        const flicker = 1 - 0.35 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 24 * t));
        const env = Math.min(1, t / 0.05, (len - t) / 0.06);
        return (low.sine(f) + fifth.sine(f * 1.5) * 0.3 + bp.run(r() * 2 - 1) * 0.3) * flicker * Math.max(0, env) * 0.7;
      },
      0.01,
    ),
  );
};

/** C, E, G: three clean chimes walking up, left to right. */
export const unlock: Effect = ({ pitch }) => {
  const k = ratio(pitch);
  const out = stereo(Math.round(0.9 * SR));
  const notes = [
    [1046.5, 0, 0.22, -0.2],
    [1318.5, 0.075, 0.22, 0],
    [1568, 0.15, 0.35, 0.2],
  ] as const;
  for (const [f, at, decay, pan] of notes) into(out, bell({ freq: f * k, ratio: 2, index: 1, bright: 0.06, decay }), at, 1, pan);
  return out;
};
