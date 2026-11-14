// Moving air: a whoosh past the camera, a whip pan, a paper plane, and the
// riser that climbs toward a drop.

import { Biquad } from '../synth/biquad.ts';
import { Osc } from '../synth/osc.ts';
import { hz, ratio } from '../synth/pitch.ts';
import { rand } from '../synth/rand.ts';
import { panOf } from '../synth/stereo.ts';
import { pair, sides } from './sample.ts';
import type { SfxFn } from './types.ts';

/** Noise swelling and falling as its band rises and comes down, moving left to right. */
export const whoosh: SfxFn = ({ pitch, noise }) => {
  const k = ratio(pitch);
  const dur = 0.55;
  const a = rand(noise);
  const b = rand(noise + 1);
  const bpl = new Biquad();
  const bpr = new Biquad();
  const lpl = new Biquad().set('lp', 260, 0.7);
  const lpr = new Biquad().set('lp', 260, 0.7);
  const n: [number, number] = [0, 0];
  return sides(dur, (t, i, lr) => {
    const u = t / dur;
    if ((i & 15) === 0) {
      const f = (400 + 2200 * Math.sin(Math.PI * u) ** 1.5) * k;
      bpl.set('bp', f, 0.9);
      bpr.set('bp', f * 1.05, 0.9);
    }
    pair(a() * 2 - 1, b() * 2 - 1, 0.6, n);
    const env = Math.sin(Math.PI * u) ** 1.6;
    const [gl, gr] = panOf(-0.5 + u);
    lr[0] = (bpl.run(n[0]) * 1.8 + lpl.run(n[0]) * 0.5) * env * gl;
    lr[1] = (bpr.run(n[1]) * 1.8 + lpr.run(n[1]) * 0.5) * env * gr;
  });
};

/** A short, sharp whoosh: its band leaps up, fast across the field. */
export const whip: SfxFn = ({ pitch, noise }) => {
  const k = ratio(pitch);
  const dur = 0.22;
  const a = rand(noise);
  const b = rand(noise + 1);
  const bpl = new Biquad();
  const bpr = new Biquad();
  const n: [number, number] = [0, 0];
  return sides(dur, (t, i, lr) => {
    const u = t / dur;
    if ((i & 15) === 0) {
      const f = 1200 * (6000 / 1200) ** u * k;
      bpl.set('bp', f, 1.2);
      bpr.set('bp', f * 1.04, 1.2);
    }
    pair(a() * 2 - 1, b() * 2 - 1, 0.5, n);
    const env = t < 0.07 ? (t / 0.07) ** 2 : Math.exp(-(t - 0.07) / 0.04);
    const [gl, gr] = panOf(-0.6 + 1.2 * u);
    lr[0] = bpl.run(n[0]) * 2 * env * gl;
    lr[1] = bpr.run(n[1]) * 2 * env * gr;
  });
};

/** Light air with a narrow band that rises and falls as it flies past, crossing the field. */
export const paper: SfxFn = ({ pitch, noise, nth }) => {
  const k = ratio(pitch);
  const dur = 0.45;
  const a = rand(noise);
  const bp = new Biquad();
  const dir = nth % 2 ? -1 : 1;
  return sides(dur, (t, i, lr) => {
    const u = t / dur;
    if ((i & 15) === 0) bp.set('bp', (1800 + 3400 * Math.sin(Math.PI * u) - 900 * u) * k, 2);
    const v = bp.run(a() * 2 - 1) * Math.sin(Math.PI * u) ** 1.4 * 2.4;
    const [gl, gr] = panOf(dir * (-0.7 + 1.4 * u));
    lr[0] = v * gl;
    lr[1] = v * gr;
  });
};

/** Noise and three saws climbing two octaves, ever wider and louder, ending on the cue's length. */
export const riser: SfxFn = ({ pitch, len, noise }) => {
  const a = rand(noise);
  const b = rand(noise + 1);
  const bpl = new Biquad();
  const bpr = new Biquad();
  const lpl = new Biquad();
  const lpr = new Biquad();
  const saws = [new Osc(0), new Osc(0.33), new Osc(0.66)];
  const n: [number, number] = [0, 0];
  return sides(
    len,
    (t, i, lr) => {
      const u = Math.min(1, t / len);
      if ((i & 15) === 0) {
        const f = 250 * (9000 / 250) ** u;
        bpl.set('bp', f, 1 + 1.5 * u);
        bpr.set('bp', f * 1.03, 1 + 1.5 * u);
        lpl.set('lp', 400 * 20 ** u, 0.9);
        lpr.set('lp', 400 * 20 ** u, 0.9);
      }
      const f = hz(57 + 24 * u + pitch);
      const s0 = saws[0].saw(f * ratio(-0.12));
      const s1 = saws[1].saw(f);
      const s2 = saws[2].saw(f * ratio(0.12));
      pair(a() * 2 - 1, b() * 2 - 1, 0.2 + 0.8 * u, n);
      const en = u ** 2.2;
      const es = u ** 1.8;
      lr[0] = bpl.run(n[0]) * en * 1.6 + lpl.run(s0 + s1 * 0.6) * es * 0.3;
      lr[1] = bpr.run(n[1]) * en * 1.6 + lpr.run(s2 + s1 * 0.6) * es * 0.3;
    },
    0.005,
  );
};
