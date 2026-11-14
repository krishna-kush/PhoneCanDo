// A-01's body: the spring of a jump, the thud of a landing.

import { Biquad } from '../synth/biquad.ts';
import { ad } from '../synth/env.ts';
import { Osc } from '../synth/osc.ts';
import { ratio } from '../synth/pitch.ts';
import { rand } from '../synth/rand.ts';
import { dual } from '../synth/stereo.ts';
import { mono } from './sample.ts';
import type { SfxFn } from './types.ts';

/** A jaw-harp boing: a pitch bending up two octaves, wobbling as it goes. */
export const boing: SfxFn = ({ pitch }) => {
  const k = ratio(pitch);
  const sine = new Osc();
  const tri = new Osc();
  const lp = new Biquad().set('lp', 3000, 0.7);
  return dual(
    mono(0.42, (t) => {
      const wobble = 1 + 0.07 * Math.sin(2 * Math.PI * 13 * t) * Math.exp(-t / 0.2);
      const f = 140 * k * 2 ** (2.2 * (1 - Math.exp(-t / 0.11))) * wobble;
      return lp.run(sine.sine(f) * 0.7 + tri.tri(f) * 0.4) * ad(t, 0.004, 0.16);
    }),
  );
};

export const land: SfxFn = ({ pitch, noise }) => {
  const k = ratio(pitch);
  const r = rand(noise);
  const lp = new Biquad().set('lp', 500, 0.7);
  const o = new Osc();
  return dual(
    mono(0.2, (t) => o.sine((55 + 75 * Math.exp(-t / 0.025)) * k) * ad(t, 0.001, 0.05) + lp.run(r() * 2 - 1) * Math.exp(-t / 0.025) * 0.5),
  );
};
