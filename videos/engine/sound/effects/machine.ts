// The machine's noises: a record scratch, a glitch, a download racing.

import { SR } from '../rate.ts';
import { Biquad } from '../synth/biquad.ts';
import { ad } from '../synth/env.ts';
import { OnePole } from '../synth/onepole.ts';
import { Osc } from '../synth/osc.ts';
import { hz, ratio } from '../synth/pitch.ts';
import { rand } from '../synth/rand.ts';
import { crush } from '../synth/shape.ts';
import { dual, panOf, stereo } from '../synth/stereo.ts';
import { mono } from './sample.ts';
import type { Effect } from './types.ts';

/** The record's speed through a scratch: pushed forward, then dragged back. */
function speedOf(t: number): number {
  if (t < 0.16) return 3 * Math.sin((Math.PI * t) / 0.16);
  if (t < 0.18) return 0;
  if (t < 0.42) return -2.5 * Math.sin((Math.PI * (t - 0.18)) / 0.24);
  return 0;
}

/** A tone and its grit whose pitch follows the record's speed, silent where it turns. */
export const scratch: Effect = ({ pitch, noise }) => {
  const k = ratio(pitch);
  const r = rand(noise);
  const saw = new Osc();
  const bp = new Biquad();
  const hp = new Biquad().set('hp', 250, 0.7);
  const lp = new Biquad().set('lp', 5000, 0.7);
  const smooth = new OnePole(0.002);
  return dual(
    mono(0.45, (t, i) => {
      const speed = Math.abs(speedOf(t));
      if ((i & 15) === 0) bp.set('bp', (600 + 1800 * speed) * k, 1.2);
      const amp = smooth.run((speed / 3) ** 0.8);
      const v = saw.saw(140 * (0.3 + speed) * k) * 0.6 + bp.run(r() * 2 - 1) * 1.4;
      return lp.run(hp.run(v)) * amp;
    }),
  );
};

/** Slices of broken signal: crushed noise, stray blips, a stutter, gaps; each slice its own side. */
export const glitch: Effect = ({ noise }) => {
  const r = rand(noise);
  const out = stereo(Math.round(0.32 * SR));
  const BLIPS = [81, 84, 88, 93];
  let at = 0;
  let last: Float32Array = new Float32Array(0);
  while (at < out.l.length) {
    const n = Math.min(out.l.length - at, Math.round((0.02 + 0.025 * r()) * SR));
    const pick = r();
    let slice: Float32Array;
    if (pick < 0.35) {
      // Crushed noise, held at a low rate.
      const hold = 4 + Math.floor(r() * 8);
      let v = 0;
      slice = mono(n / SR, (_, i) => {
        if (i % hold === 0) v = crush(r() * 2 - 1, 3);
        return v * 0.7;
      }, 0.001);
    } else if (pick < 0.65) {
      const o = new Osc();
      const f = hz(BLIPS[Math.floor(r() * BLIPS.length)]);
      slice = mono(n / SR, (t) => o.pulse(f, 0.25) * ad(t, 0.001, 0.02) * 0.6, 0.001);
    } else if (pick < 0.85 && last.length) {
      // Stutter: the last slice's start, three times over.
      const piece = Math.min(last.length, Math.round(0.012 * SR));
      slice = mono(n / SR, (_, i) => last[i % piece], 0.001);
    } else {
      slice = new Float32Array(n);
    }
    const [gl, gr] = panOf(r() * 1.2 - 0.6);
    for (let i = 0; i < slice.length; i++) {
      out.l[at + i] += slice[i] * gl;
      out.r[at + i] += slice[i] * gr;
    }
    if (slice.some((v) => v !== 0)) last = slice;
    at += n;
  }
  return out;
};

/** A minor pentatonic, the notes a rising run steps through. */
const PENTA = [0, 3, 5, 7, 10];

/** Blips racing up A minor's pentatonic for the cue's length. */
export const progress: Effect = ({ pitch, len }) => {
  const every = 0.032;
  const count = Math.max(2, Math.floor(len / every));
  const out = stereo(Math.round((len + 0.03) * SR));
  for (let k = 0; k < count; k++) {
    const step = Math.floor((k * 9) / count);
    const midi = 69 + 12 * Math.floor(step / PENTA.length) + PENTA[step % PENTA.length] + pitch;
    const o = new Osc();
    const f = hz(midi);
    const blip = mono(0.018, (t) => o.pulse(f, 0.25) * ad(t, 0.0005, 0.006), 0.002);
    const at = Math.round(k * every * SR);
    const [gl, gr] = panOf(k % 2 ? 0.25 : -0.25);
    for (let i = 0; i < blip.length && at + i < out.l.length; i++) {
      out.l[at + i] += blip[i] * gl;
      out.r[at + i] += blip[i] * gr;
    }
  }
  return out;
};
