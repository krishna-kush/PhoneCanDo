// The bass: a saw and a square through a resonant lowpass that snaps shut
// on each note, a sine an octave under it for the weight. Mono.

import { SR } from '../../rate.ts';
import { Biquad } from '../../synth/biquad.ts';
import { gate } from '../../synth/env.ts';
import { Osc } from '../../synth/osc.ts';
import { hz } from '../../synth/pitch.ts';

export type Bass = {
  midi: number;
  /** Seconds held. */
  len: number;
  /** Where the filter settles, and how far above it each note starts, in Hz. */
  cutoff?: number;
  sweep?: number;
  q?: number;
  /** The octave-down sine's level. */
  sub?: number;
};

export function bass({ midi, len, cutoff = 480, sweep = 2400, q = 1.1, sub = 0.35 }: Bass): Float32Array {
  const f = hz(midi);
  const release = 0.015;
  const n = Math.round(SR * (len + release));
  const out = new Float32Array(n);
  const saw = new Osc();
  const square = new Osc(0.25);
  const low = new Osc();
  const lp = new Biquad();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if ((i & 15) === 0) lp.set('lp', cutoff + sweep * Math.exp(-t / 0.06), q);
    const raw = 0.55 * saw.saw(f) + 0.45 * square.pulse(f * 1.004, 0.5);
    out[i] = (lp.run(raw) + sub * low.sine(f / 2)) * gate(t, len, 0.003, release);
  }
  return out;
}
