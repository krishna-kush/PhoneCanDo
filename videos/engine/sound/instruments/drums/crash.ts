// A crash cymbal: bright noise and high metal, each side its own, ringing
// out over a couple of seconds.

import { SR } from '../../rate.ts';
import { Biquad } from '../../synth/biquad.ts';
import { tail } from '../../synth/env.ts';
import { rand } from '../../synth/rand.ts';
import { stereo, type Stereo } from '../../synth/stereo.ts';

const METAL = [553, 789, 1032, 1347, 1591, 2047];

export function crash({ decay = 0.7, seed = 1 }: { decay?: number; seed?: number } = {}): Stereo {
  const n = Math.round(SR * (decay * 3.6 + 0.05));
  const out = stereo(n);
  const fade = Math.round(0.02 * SR);
  for (const [side, buf] of [out.l, out.r].entries()) {
    const r = rand(seed * 2 + side);
    const phases = METAL.map(() => r());
    const hp = new Biquad().set('hp', 3500, 0.7);
    const lp = new Biquad().set('lp', 11000, 0.7);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let m = 0;
      for (let k = 0; k < METAL.length; k++) {
        phases[k] = (phases[k] + METAL[k] / SR) % 1;
        m += phases[k] < 0.5 ? 1 : -1;
      }
      const raw = (r() * 2 - 1) * 0.6 + (m / METAL.length) * 0.4;
      const amp = (t < 0.001 ? t / 0.001 : 1) * Math.exp(-t / decay);
      buf[i] = lp.run(hp.run(raw)) * amp * 1.6 * tail(i, n, fade);
    }
  }
  return out;
}
