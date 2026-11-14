// Stereo buffers, panning, and adding one sound into another at a sample,
// faded out short of a limit so a sound cut off by a hard stop never clicks.

import { SR } from '../rate.ts';

export type Stereo = { l: Float32Array; r: Float32Array };

export const stereo = (n: number): Stereo => ({ l: new Float32Array(n), r: new Float32Array(n) });

/** Equal-power pan gains, unity at the centre: -1 left to 1 right. */
export function panOf(pan: number): readonly [number, number] {
  const a = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  return [Math.cos(a) * Math.SQRT2, Math.sin(a) * Math.SQRT2];
}

/** How long a sound takes to fade when a limit cuts it off. */
const FADE = Math.round(0.004 * SR);

/** The gain at sample [i] for a sound that would run to [end] but must be silent from [limit]. */
const cut = (i: number, end: number, limit: number) => (end <= limit || i < limit - FADE ? 1 : Math.max(0, (limit - i) / FADE));

/** Adds mono [src] into [dst] from sample [at], with [gain] and [pan], silent from [limit] on. */
export function addMono(dst: Stereo, src: Float32Array, at: number, gain: number, pan = 0, limit = Infinity) {
  const [gl, gr] = panOf(pan);
  const end = at + src.length;
  const stop = Math.min(end, dst.l.length, limit);
  for (let i = Math.max(0, at); i < stop; i++) {
    const v = src[i - at] * gain * cut(i, end, limit);
    dst.l[i] += v * gl;
    dst.r[i] += v * gr;
  }
}

/** Adds stereo [src] into [dst] from sample [at], with [gain] and a balance [pan], silent from [limit] on. */
export function addStereo(dst: Stereo, src: Stereo, at: number, gain: number, pan = 0, limit = Infinity) {
  const [gl, gr] = panOf(pan);
  const end = at + src.l.length;
  const stop = Math.min(end, dst.l.length, limit);
  for (let i = Math.max(0, at); i < stop; i++) {
    const k = gain * cut(i, end, limit);
    dst.l[i] += src.l[i - at] * k * gl;
    dst.r[i] += src.r[i - at] * k * gr;
  }
}

/** [s] times [gain], in place. */
export function scale(s: Stereo, gain: number): Stereo {
  for (let i = 0; i < s.l.length; i++) {
    s.l[i] *= gain;
    s.r[i] *= gain;
  }
  return s;
}

/** A mono buffer as stereo, the same in both sides. */
export const dual = (m: Float32Array): Stereo => ({ l: m, r: Float32Array.from(m) });

/** The highest absolute sample in either side. */
export function peakOf(s: Stereo): number {
  let p = 0;
  for (let i = 0; i < s.l.length; i++) p = Math.max(p, Math.abs(s.l[i]), Math.abs(s.r[i]));
  return p;
}
