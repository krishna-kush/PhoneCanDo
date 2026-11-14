// A low reed, a bassoon's cousin: a narrow pulse for the nasal buzz and a
// saw for the body, through a formant and a dark lowpass. It speaks slowly
// and a little vibrato creeps in on held notes. Mono.

import { SR } from '../../rate.ts';
import { Biquad } from '../../synth/biquad.ts';
import { gate } from '../../synth/env.ts';
import { Osc } from '../../synth/osc.ts';
import { hz } from '../../synth/pitch.ts';

export type Reed = {
  midi: number;
  /** Seconds held. */
  len: number;
  /** How slowly it speaks, in seconds. */
  attack?: number;
  /** The lowpass's corner, in Hz. */
  cutoff?: number;
  /** How far the vibrato swings, in semitones. */
  vibrato?: number;
};

export function reed({ midi, len, attack = 0.07, cutoff = 1500, vibrato = 0.12 }: Reed): Float32Array {
  const release = 0.09;
  const n = Math.round(SR * (len + release));
  const out = new Float32Array(n);
  const buzz = new Osc();
  const body = new Osc(0.5);
  const hp = new Biquad().set('hp', 70, 0.7);
  // The "o" a bassoon's bore gives every note.
  const formant = new Biquad().set('peak', 520, 1.2, 6);
  const lp = new Biquad().set('lp', cutoff, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const swing = vibrato * Math.min(1, Math.max(0, (t - 0.15) / 0.25)) * Math.sin(2 * Math.PI * 5.2 * t);
    const f = hz(midi + swing);
    const raw = 0.6 * buzz.pulse(f, 0.3) + 0.4 * body.saw(f);
    out[i] = lp.run(formant.run(hp.run(raw))) * gate(t, len, attack, release) * 0.4;
  }
  return out;
}
