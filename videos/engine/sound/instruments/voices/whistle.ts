// A slide whistle: a sine gliding from one note to another as the plunger
// moves, a faint overtone, and a little breath around the note. Mono.

import { SR } from '../../rate.ts';
import { Biquad } from '../../synth/biquad.ts';
import { gate, smooth } from '../../synth/env.ts';
import { Osc } from '../../synth/osc.ts';
import { hz } from '../../synth/pitch.ts';
import { rand } from '../../synth/rand.ts';

export type Whistle = {
  /** The notes it glides from and to (MIDI). */
  from: number;
  to: number;
  /** Seconds blown: the glide takes most of it, the last of it holds the note it reached. */
  len: number;
  /** The breath's level against the tone. */
  breath?: number;
  seed?: number;
};

/** The share of the note the glide takes: a score that wants it to arrive on a beat blows it that much longer. */
export const GLIDE = 0.85;

export function whistle({ from, to, len, breath = 0.12, seed = 1 }: Whistle): Float32Array {
  const release = 0.04;
  const n = Math.round(SR * (len + release));
  const out = new Float32Array(n);
  const tone = new Osc();
  const over = new Osc();
  const r = rand(seed);
  const air = new Biquad();
  const lp = new Biquad().set('lp', 5000, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const wobble = 0.12 * Math.sin(2 * Math.PI * 6 * t);
    const f = hz(from + (to - from) * smooth(t / (len * GLIDE)) + wobble);
    if ((i & 15) === 0) air.set('bp', f * 2, 3);
    const v = tone.sine(f) + 0.06 * over.sine(f * 2) + air.run(r() * 2 - 1) * breath * 3;
    out[i] = lp.run(v) * gate(t, len, 0.03, release) * 0.5;
  }
  return out;
}
