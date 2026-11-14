// The snare family: a snare (noise over a pitched body), a clap (a few
// quick bursts and a tail) and a rimshot (a short knock).

import { SR } from '../../rate.ts';
import { Biquad } from '../../synth/biquad.ts';
import { tail } from '../../synth/env.ts';
import { Osc } from '../../synth/osc.ts';
import { rand } from '../../synth/rand.ts';
import { drive } from '../../synth/shape.ts';

export function snare({ tone = 185, decay = 0.11, seed = 1 }: { tone?: number; decay?: number; seed?: number } = {}): Float32Array {
  const n = Math.round(SR * (decay * 4 + 0.03));
  const out = new Float32Array(n);
  const r = rand(seed);
  const bp = new Biquad().set('bp', 1900, 0.8);
  const hp = new Biquad().set('hp', 280, 0.7);
  const body = new Osc(0.25);
  const fade = Math.round(0.004 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const attack = t < 0.0005 ? t / 0.0005 : 1;
    const noise = hp.run(bp.run(r() * 2 - 1)) * Math.exp(-t / decay) * 2.2;
    const pitch = body.tri(tone * (1 + 0.18 * Math.exp(-t / 0.008))) * Math.exp(-t / 0.045);
    out[i] = drive((noise * 0.85 + pitch * 0.5) * attack, 1.3) * tail(i, n, fade);
  }
  return out;
}

/** The clap's bursts, in seconds from its start; the tail rings from the last. */
const BURSTS = [0, 0.009, 0.018, 0.027];

export function clap({ decay = 0.09, seed = 1 }: { decay?: number; seed?: number } = {}): Float32Array {
  const n = Math.round(SR * (decay * 4 + 0.06));
  const out = new Float32Array(n);
  const r = rand(seed);
  const bp = new Biquad().set('bp', 1250, 0.9);
  const hp = new Biquad().set('hp', 550, 0.7);
  const last = BURSTS[BURSTS.length - 1];
  const fade = Math.round(0.004 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let amp = 0;
    for (const b of BURSTS) if (t >= b) amp = Math.max(amp, Math.exp(-(t - b) / 0.0035));
    if (t >= last) amp = Math.max(amp, 0.6 * Math.exp(-(t - last) / decay));
    out[i] = drive(hp.run(bp.run(r() * 2 - 1)) * amp * 2.6, 1.2) * tail(i, n, fade);
  }
  return out;
}

export function rim({ seed = 1 }: { seed?: number } = {}): Float32Array {
  const n = Math.round(SR * 0.07);
  const out = new Float32Array(n);
  const r = rand(seed);
  const bp = new Biquad().set('bp', 1750, 3.5);
  const knock = new Osc();
  const fade = Math.round(0.004 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const attack = t < 0.0003 ? t / 0.0003 : 1;
    const noise = bp.run(r() * 2 - 1) * Math.exp(-t / 0.008) * 3;
    const tone = knock.sine(820) * Math.exp(-t / 0.012);
    out[i] = (noise * 0.6 + tone * 0.7) * attack * tail(i, n, fade);
  }
  return out;
}
