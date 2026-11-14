// Building a sound sample by sample: a buffer of a given length filled from
// a function of time and faded at its end, so it never clicks off.

import { SR } from '../rate.ts';
import { tail } from '../synth/env.ts';
import { panOf, stereo, type Stereo } from '../synth/stereo.ts';

/** A mono sound [seconds] long, [f] giving each sample from its time. */
export function mono(seconds: number, f: (t: number, i: number) => number, fade = 0.004): Float32Array {
  const n = Math.max(1, Math.round(seconds * SR));
  const out = new Float32Array(n);
  const k = Math.round(fade * SR);
  for (let i = 0; i < n; i++) out[i] = f(i / SR, i) * tail(i, n, k);
  return out;
}

/** A stereo sound [seconds] long, [f] writing each sample's left and right into [lr]. */
export function sides(seconds: number, f: (t: number, i: number, lr: [number, number]) => void, fade = 0.004): Stereo {
  const n = Math.max(1, Math.round(seconds * SR));
  const out = stereo(n);
  const k = Math.round(fade * SR);
  const lr: [number, number] = [0, 0];
  for (let i = 0; i < n; i++) {
    f(i / SR, i, lr);
    const g = tail(i, n, k);
    out.l[i] = lr[0] * g;
    out.r[i] = lr[1] * g;
  }
  return out;
}

/** Adds [src] into [dst] from [seconds] in, at [gain] and [pan]. */
export function into(dst: Stereo, src: Float32Array, seconds: number, gain = 1, pan = 0) {
  const at = Math.round(seconds * SR);
  const [gl, gr] = panOf(pan);
  const end = Math.min(dst.l.length, at + src.length);
  for (let i = at; i < end; i++) {
    dst.l[i] += src[i - at] * gain * gl;
    dst.r[i] += src[i - at] * gain * gr;
  }
}

/** A noise whose two sides drift apart as [width] goes from 0 (the same) to 1 (unrelated). */
export function pair(a: number, b: number, width: number, lr: [number, number]) {
  const w = Math.max(0, Math.min(1, width));
  lr[0] = a;
  lr[1] = (1 - w) * a + w * b;
}
