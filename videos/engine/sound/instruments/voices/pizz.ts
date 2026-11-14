// A plucked string, pizzicato: a burst of dull noise going round a delay
// one period long, losing its top on every trip (Karplus-Strong), then a
// wooden body and a dark lowpass. Short: the finger stops it. Mono.

import { SR } from '../../rate.ts';
import { Biquad } from '../../synth/biquad.ts';
import { tail } from '../../synth/env.ts';
import { hz } from '../../synth/pitch.ts';
import { rand } from '../../synth/rand.ts';

export type Pizz = {
  midi: number;
  /** Seconds before the string is stopped; left to die away when left out. */
  len?: number;
  /** How fast the note dies away, in seconds. */
  decay?: number;
  /** How bright the pluck is, 0 (a thumb) to 1 (a nail). */
  bright?: number;
  seed?: number;
};

/** The highest sample a pluck reaches, so a low string and a high one sit at one level. */
const PEAK = 0.5;

export function pizz({ midi, len, decay = 0.2, bright = 0.3, seed = 1 }: Pizz): Float32Array {
  const f = hz(midi);
  const whole = decay * 6 + 0.01;
  const stop = 0.02;
  const held = len === undefined ? whole : Math.min(whole, len + stop);
  const n = Math.round(SR * held);
  // The loop's two-point average holds half a sample, so the delay is that much short of a period.
  const period = SR / f - 0.5;
  const back = Math.floor(period);
  const frac = period - back;

  // The pluck: one period of noise, dulled, with no DC to go round for ever.
  const r = rand(seed);
  const burst = new Float32Array(back + 1);
  const dull = Math.exp((-2 * Math.PI * (500 + 3000 * bright)) / SR);
  let low = 0;
  let mean = 0;
  for (let i = 0; i < burst.length; i++) {
    low = (r() * 2 - 1) * (1 - dull) + low * dull;
    burst[i] = low;
    mean += low / burst.length;
  }
  for (let i = 0; i < burst.length; i++) burst[i] -= mean;

  const string = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = i >= back ? string[i - back] : 0;
    const b = i > back ? string[i - back - 1] : 0;
    const c = i > back + 1 ? string[i - back - 2] : 0;
    // The delay's fraction of a sample, read between its neighbours, then the average that dulls each trip.
    string[i] = (i < burst.length ? burst[i] : 0) + 0.996 * 0.5 * (a + (b - a) * frac + b + (c - b) * frac);
  }

  const out = new Float32Array(n);
  const hp = new Biquad().set('hp', Math.max(30, f * 0.5), 0.7);
  const wood = new Biquad().set('peak', 240, 1, 4);
  const lp = new Biquad().set('lp', 1400 + 2600 * bright, 0.7);
  const fade = Math.round(stop * SR);
  let top = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = lp.run(wood.run(hp.run(string[i]))) * Math.exp(-t / decay) * tail(i, n, fade);
    top = Math.max(top, Math.abs(out[i]));
  }
  if (top > 0) for (let i = 0; i < n; i++) out[i] *= PEAK / top;
  return out;
}
