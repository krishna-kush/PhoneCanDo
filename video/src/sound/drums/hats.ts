// Hi-hats the 808's way: six square waves at clashing pitches, a little
// noise, everything below 7 kHz taken out and the very top tamed.

import { SR } from '../rate.ts';
import { Biquad } from '../synth/biquad.ts';
import { tail } from '../synth/env.ts';
import { rand } from '../synth/rand.ts';

/** The six squares, near enough the 808's. */
const METAL = [263, 400, 421, 474, 587, 845];

export function hat({ open = false, seed = 1 }: { open?: boolean; seed?: number } = {}): Float32Array {
  const decay = open ? 0.075 : 0.018;
  const n = Math.round(SR * (decay * 5 + 0.01));
  const out = new Float32Array(n);
  const r = rand(seed);
  const phases = METAL.map(() => r());
  const bp = new Biquad().set('bp', 9500, 0.8);
  const hp = new Biquad().set('hp', 7000, 0.7);
  const lp = new Biquad().set('lp', 13000, 0.7);
  const fade = Math.round(0.003 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let m = 0;
    for (let k = 0; k < METAL.length; k++) {
      phases[k] = (phases[k] + METAL[k] / SR) % 1;
      m += phases[k] < 0.5 ? 1 : -1;
    }
    const raw = m / METAL.length + (r() * 2 - 1) * 0.4;
    const amp = (t < 0.0003 ? t / 0.0003 : 1) * Math.exp(-t / decay);
    out[i] = lp.run(hp.run(bp.run(raw))) * amp * 2.4 * tail(i, n, fade);
  }
  return out;
}
