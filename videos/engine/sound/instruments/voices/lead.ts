// A lead for a tune to sing on: a chiptune pulse with a detuned square
// beside it for width, a quick slide in from the note before, and vibrato
// that creeps in on held notes.

import { SR } from '../../rate.ts';
import { Biquad } from '../../synth/biquad.ts';
import { gate } from '../../synth/env.ts';
import { Osc } from '../../synth/osc.ts';
import { hz } from '../../synth/pitch.ts';
import { stereo, type Stereo } from '../../synth/stereo.ts';

export type Lead = {
  midi: number;
  /** Seconds held. */
  len: number;
  /** The note it slides in from, when it follows one without a break. */
  from?: number;
  duty?: number;
  /** The lowpass's corner, in Hz. */
  cutoff?: number;
};

export function lead({ midi, len, from, duty = 0.25, cutoff = 6500 }: Lead): Stereo {
  const release = 0.05;
  const n = Math.round(SR * (len + release));
  const out = stereo(n);
  const a = new Osc();
  const b = new Osc(0.5);
  const lpl = new Biquad().set('lp', cutoff, 0.7);
  const lpr = new Biquad().set('lp', cutoff, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const slide = from === undefined ? 0 : (from - midi) * Math.exp(-t / 0.012);
    const vib = t > 0.12 ? 0.18 * Math.min(1, (t - 0.12) / 0.1) * Math.sin(2 * Math.PI * 5.8 * t) : 0;
    const f = hz(midi + slide + vib);
    const env = gate(t, len, 0.004, release) * (0.78 + 0.22 * Math.exp(-t / 0.09));
    const va = a.pulse(f, duty);
    const vb = b.pulse(f * 1.004, 0.5);
    out.l[i] = lpl.run(va * 0.72 + vb * 0.28) * env * 0.5;
    out.r[i] = lpr.run(va * 0.28 + vb * 0.72) * env * 0.5;
  }
  return out;
}
