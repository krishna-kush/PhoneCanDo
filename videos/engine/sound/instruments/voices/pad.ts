// The pad: each chord tone a pair of saws, one a little flat on the left
// and one a little sharp on the right, through a lowpass that can move
// while it holds.

import { SR } from '../../rate.ts';
import { Biquad } from '../../synth/biquad.ts';
import { gate } from '../../synth/env.ts';
import { Osc } from '../../synth/osc.ts';
import { hz, ratio } from '../../synth/pitch.ts';
import { stereo, type Stereo } from '../../synth/stereo.ts';

export type Pad = {
  notes: readonly number[];
  /** Seconds held. */
  len: number;
  attack?: number;
  release?: number;
  /** The lowpass's corner in Hz, fixed or by seconds into the note. */
  cutoff?: number | ((t: number) => number);
  q?: number;
  /** Cents each saw is pulled off the note. */
  detune?: number;
  /** A time constant the held level falls away with, for a chord left ringing; held flat when left out. */
  decay?: number;
};

export function pad({ notes, len, attack = 0.01, release = 0.12, cutoff = 3000, q = 0.8, detune = 9, decay }: Pad): Stereo {
  const n = Math.round(SR * (len + release));
  const out = stereo(n);
  const freqs = notes.map(hz);
  const left = freqs.map((_, k) => new Osc((k * 0.37) % 1));
  const right = freqs.map((_, k) => new Osc((k * 0.61 + 0.5) % 1));
  const down = ratio(-detune / 100);
  const up = ratio(detune / 100);
  const lpl = new Biquad();
  const lpr = new Biquad();
  const level = 0.55 / Math.sqrt(notes.length);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if ((i & 31) === 0) {
      const c = typeof cutoff === 'number' ? cutoff : cutoff(t);
      lpl.set('lp', c, q);
      lpr.set('lp', c, q);
    }
    let l = 0;
    let r = 0;
    for (let k = 0; k < freqs.length; k++) {
      l += left[k].saw(freqs[k] * down);
      r += right[k].saw(freqs[k] * up);
    }
    const env = gate(t, len, attack, release) * (decay ? Math.exp(-t / decay) : 1) * level;
    out.l[i] = lpl.run(l) * env;
    out.r[i] = lpr.run(r) * env;
  }
  return out;
}
