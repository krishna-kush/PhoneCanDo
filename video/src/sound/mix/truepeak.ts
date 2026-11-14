// True peak: how high the wave swings between samples too, as a player
// rebuilding it will. Found by upsampling four times with a windowed sinc,
// as BS.1770's meter does.

import type { Stereo } from '../synth/stereo.ts';

/** Taps either side of the point being rebuilt. */
const SIDE = 8;

/** For each in-between point (a quarter, a half, three quarters on), its taps from SIDE-1 before to SIDE after. */
const KERNELS = [0.25, 0.5, 0.75].map((p) => {
  const k = new Float64Array(2 * SIDE);
  for (let j = -SIDE + 1; j <= SIDE; j++) {
    const x = p - j;
    const sinc = Math.sin(Math.PI * x) / (Math.PI * x);
    const window = 0.5 + 0.5 * Math.cos((Math.PI * x) / SIDE);
    k[j + SIDE - 1] = sinc * window;
  }
  return k;
});

/** The highest the wave reaches from sample [i] up to (not including) the next, in one side. */
function reach(x: Float32Array, i: number): number {
  let top = Math.abs(x[i]);
  if (i - SIDE + 1 < 0 || i + SIDE >= x.length) return top;
  for (const k of KERNELS) {
    let v = 0;
    for (let j = 0; j < k.length; j++) v += x[i - SIDE + 1 + j] * k[j];
    top = Math.max(top, Math.abs(v));
  }
  return top;
}

/** At each sample, the highest the wave reaches from it to the next, either side. */
export function peaks(s: Stereo): Float32Array {
  const out = new Float32Array(s.l.length);
  for (let i = 0; i < out.length; i++) out[i] = Math.max(reach(s.l, i), reach(s.r, i));
  return out;
}

/** The true peak, linear. */
export function truePeak(s: Stereo): number {
  let top = 0;
  for (let i = 0; i < s.l.length; i++) top = Math.max(top, reach(s.l, i), reach(s.r, i));
  return top;
}

export const db = (v: number) => 20 * Math.log10(v);
