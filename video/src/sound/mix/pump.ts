// The kick's pump: how far under each kick the pumped tracks duck, falling
// in a few ms and swelling back over most of a beat. One curve, each track
// taking it at its own depth (score/tracks.ts PUMP).

import { SR } from '../rate.ts';
import type { Pump } from '../score/play.ts';
import { smooth } from '../synth/env.ts';
import type { Stereo } from '../synth/stereo.ts';

/** How deep the duck is at each sample, 0 to 1, from every kick. */
export function pumpCurve(pumps: readonly Pump[], n: number, release = 0.3): Float32Array {
  const d = new Float32Array(n);
  const a = Math.round(0.003 * SR);
  const r = Math.round(release * SR);
  for (const p of pumps) {
    for (let i = 0; i < a + r; i++) {
      const k = p.at + i;
      if (k < 0) continue;
      if (k >= n) break;
      const v = p.depth * (i < a ? i / a : 1 - smooth((i - a) / r));
      if (v > d[k]) d[k] = v;
    }
  }
  return d;
}

/** [s] ducked under the curve at [depth], in place. */
export function pump(s: Stereo, curve: Float32Array, depth: number) {
  for (let i = 0; i < s.l.length; i++) {
    const g = 1 - depth * curve[i];
    s.l[i] *= g;
    s.r[i] *= g;
  }
}
