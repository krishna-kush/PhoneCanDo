// The kick: a sine diving from a punch down to A1 (`lo`, for a score in
// another key), with a beater's click on top so it still reads on a
// phone's small speaker. Without the click and shorter, it is a heartbeat.

import { SR } from '../../rate.ts';
import { Biquad } from '../../synth/biquad.ts';
import { tail } from '../../synth/env.ts';
import { rand } from '../../synth/rand.ts';
import { drive } from '../../synth/shape.ts';

export type Kick = {
  /** Where the pitch starts and where it settles, in Hz. */
  hi?: number;
  lo?: number;
  /** How fast the pitch falls, and the body's decay, in seconds. */
  drop?: number;
  decay?: number;
  click?: number;
  seed?: number;
};

export function kick({ hi = 230, lo = 55, drop = 0.028, decay = 0.17, click = 0.9, seed = 1 }: Kick = {}): Float32Array {
  const n = Math.round(SR * (decay * 5 + 0.02));
  const out = new Float32Array(n);
  const r = rand(seed);
  const beater = new Biquad().set('bp', 3800, 0.8);
  const fade = Math.round(0.005 * SR);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    phase += (lo + (hi - lo) * Math.exp(-t / drop)) / SR;
    const amp = (t < 0.0006 ? t / 0.0006 : 1) * Math.exp(-t / decay) * tail(i, n, fade);
    const body = Math.sin(2 * Math.PI * phase) * amp;
    const tick = click ? click * beater.run(r() * 2 - 1) * Math.exp(-t / 0.004) * 2.2 : 0;
    out[i] = drive(body * 1.15 + tick, 1.4);
  }
  return out;
}

/** A heartbeat: a soft low thump, no click. */
export const thump = (seed: number) => kick({ hi: 90, lo: 46, drop: 0.04, decay: 0.12, click: 0, seed });
