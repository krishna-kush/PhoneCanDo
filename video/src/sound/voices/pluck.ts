// The arp's pluck: a pulse through a lowpass, struck and let go.

import { SR } from '../rate.ts';
import { Biquad } from '../synth/biquad.ts';
import { gate } from '../synth/env.ts';
import { Osc } from '../synth/osc.ts';
import { hz } from '../synth/pitch.ts';

export type Pluck = {
  midi: number;
  /** Seconds before it is let go. */
  len: number;
  duty?: number;
  cutoff?: number;
  q?: number;
  /** How fast it dies away while held, in seconds. */
  decay?: number;
};

export function pluck({ midi, len, duty = 0.5, cutoff = 4000, q = 0.8, decay = 0.08 }: Pluck): Float32Array {
  const release = 0.012;
  const n = Math.round(SR * (len + release));
  const out = new Float32Array(n);
  const osc = new Osc();
  const lp = new Biquad().set('lp', cutoff, q);
  const f = hz(midi);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = gate(t, len, 0.001, release) * Math.exp(-t / decay);
    out[i] = lp.run(osc.pulse(f, duty)) * env * 0.5;
  }
  return out;
}
