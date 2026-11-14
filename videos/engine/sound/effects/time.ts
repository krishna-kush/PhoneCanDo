// Time passing: a clock's tick and tock, and the morning coming up.

import { bell } from '../instruments/voices/bell.ts';
import { SR } from '../rate.ts';
import { brightOf } from '../score/chord.ts';
import { Biquad } from '../synth/biquad.ts';
import { ad } from '../synth/env.ts';
import { Osc } from '../synth/osc.ts';
import { hz, ratio } from '../synth/pitch.ts';
import { rand } from '../synth/rand.ts';
import { dual, stereo } from '../synth/stereo.ts';
import { into, mono } from './sample.ts';
import type { Effect } from './types.ts';

/** Tick on the even ones, tock on the odd. */
export const clock: Effect = ({ pitch, noise, nth }) => {
  const tock = nth % 2 === 1;
  const k = ratio(pitch);
  const r = rand(noise);
  const bp = new Biquad().set('bp', (tock ? 2400 : 4000) * k, 5);
  const ring = new Osc();
  const f = (tock ? 1600 : 2300) * k;
  return dual(mono(0.06, (t) => bp.run(r() * 2 - 1) * ad(t, 0.0002, 0.006) * 3 + ring.sine(f) * ad(t, 0.0003, 0.015) * 0.5));
};

/** The chord under it, made major, rising in chimes, with a shimmer swelling over the top. */
export const sunrise: Effect = ({ pitch, chord }) => {
  const bright = brightOf(chord);
  const [a, b, c] = bright.tones;
  const notes = [a, b, c, a + 12, b + 12].map((m) => m + 12 + pitch);
  const out = stereo(Math.round(1.5 * SR));
  notes.forEach((m, i) => into(out, bell({ freq: hz(m), ratio: 2, index: 0.8, bright: 0.1, decay: 0.6 }), i * 0.065, 0.8, i % 2 ? 0.3 : -0.3));
  const top = notes[notes.length - 1];
  const s1 = new Osc();
  const s2 = new Osc();
  const shimmer = mono(1.4, (t) => {
    const swell = Math.sin(Math.PI * Math.min(1, t / 1.4)) * 0.15;
    const tremolo = 0.6 + 0.4 * Math.sin(2 * Math.PI * 6 * t);
    return (s1.sine(hz(top + 12)) + s2.sine(hz(top + 19)) * 0.6) * swell * tremolo;
  }, 0.05);
  into(out, shimmer, 0.15, 1, 0);
  return out;
};
