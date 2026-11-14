// A phone's own small sounds: a tap, keys, a message going, a
// notification, and the pop of something arriving on screen.

import { bell } from '../instruments/voices/bell.ts';
import { SR } from '../rate.ts';
import { Biquad } from '../synth/biquad.ts';
import { ad } from '../synth/env.ts';
import { Osc } from '../synth/osc.ts';
import { ratio } from '../synth/pitch.ts';
import { rand } from '../synth/rand.ts';
import { dual, stereo } from '../synth/stereo.ts';
import { into, mono } from './sample.ts';
import type { Effect } from './types.ts';

export const tap: Effect = ({ pitch, noise }) => {
  const r = rand(noise);
  const hp = new Biquad().set('hp', 2500, 0.7);
  const body = new Osc();
  const f0 = 720 * ratio(pitch);
  return dual(
    mono(0.07, (t) => {
      const f = f0 * (0.55 + 0.45 * Math.exp(-t / 0.012));
      return body.sine(f) * ad(t, 0.0008, 0.016) + hp.run(r() * 2 - 1) * Math.exp(-t / 0.0015) * 0.5;
    }),
  );
};

export const key: Effect = ({ pitch, noise }) => {
  const r = rand(noise);
  const bp = new Biquad().set('bp', 3400 * (0.9 + 0.2 * r()) * ratio(pitch), 1.2);
  const thock = new Osc();
  return dual(mono(0.03, (t) => bp.run(r() * 2 - 1) * Math.exp(-t / 0.005) * 2 + thock.sine(1100) * Math.exp(-t / 0.006) * 0.4));
};

/** A terminal's key: harder than the phone's, with a little body under the click. */
export const typeKey: Effect = ({ pitch, noise }) => {
  const r = rand(noise);
  const bp = new Biquad().set('bp', 2200 * (0.92 + 0.16 * r()) * ratio(pitch), 1.5);
  const body = new Osc();
  return dual(mono(0.045, (t) => bp.run(r() * 2 - 1) * Math.exp(-t / 0.004) * 2.4 + body.sine(210) * ad(t, 0.0005, 0.014) * 0.5));
};

export const send: Effect = ({ pitch, noise }) => {
  const r = rand(noise);
  const bp = new Biquad();
  const blip = new Osc();
  const k = ratio(pitch);
  return dual(
    mono(0.3, (t, i) => {
      if ((i & 15) === 0) bp.set('bp', 700 * (4500 / 700) ** Math.min(1, t / 0.16) * k, 1.1);
      const swish = bp.run(r() * 2 - 1) * ad(t, 0.03, 0.07) * 1.6;
      const f = 620 * k * (1320 / 620) ** Math.min(1, t / 0.06);
      return swish + blip.sine(f) * ad(t, 0.002, 0.05) * 0.5;
    }),
  );
};

/** Two clean chimes, A5 then E6: at home in A minor, whatever plays under them. */
export const notify: Effect = ({ pitch }) => {
  const k = ratio(pitch);
  const out = stereo(Math.round(0.6 * SR));
  into(out, bell({ freq: 880 * k, ratio: 2, index: 1.2, bright: 0.08, decay: 0.16 }), 0);
  into(out, bell({ freq: 1318.5 * k, ratio: 2, index: 1.2, bright: 0.08, decay: 0.2 }), 0.11);
  return out;
};

export const pop: Effect = ({ pitch }) => {
  const f0 = 520 * ratio(pitch);
  const o = new Osc();
  const h = new Osc();
  return dual(
    mono(0.13, (t) => {
      const f = f0 * (0.5 + (1 - Math.exp(-t / 0.018)));
      return (o.sine(f) + 0.2 * h.sine(2 * f)) * ad(t, 0.001, 0.035);
    }),
  );
};
