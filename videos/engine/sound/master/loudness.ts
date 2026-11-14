// Loudness the way broadcast and the video platforms measure it (ITU-R
// BS.1770): K-weighted, in LUFS. Integrated for a whole track, gated as the
// standard gates it; and the loudest short window, for a sound effect.

import { SR } from '../rate.ts';
import { Biquad } from '../synth/biquad.ts';
import type { Stereo } from '../synth/stereo.ts';

/** A biquad with the standard's own coefficients (they are for 48 kHz). */
function fixed(b: readonly number[], a: readonly number[]): Biquad {
  const f = new Biquad();
  [f.b0, f.b1, f.b2] = b;
  [f.a1, f.a2] = a;
  return f;
}

/** Each sample's K-weighted energy, both sides summed, as running totals from the start. */
function energy(s: Stereo): Float64Array {
  if (SR !== 48000) throw new Error('master/loudness.ts has K-weighting for 48 kHz only.');
  const n = s.l.length;
  const sum = new Float64Array(n + 1);
  const chains = [s.l, s.r].map((x) => ({
    x,
    shelf: fixed([1.53512485958697, -2.69169618940638, 1.19839281085285], [-1.69065929318241, 0.73248077421585]),
    hp: fixed([1, -2, 1], [-1.99004745483398, 0.99007225036621]),
  }));
  for (let i = 0; i < n; i++) {
    let e = 0;
    for (const c of chains) {
      const y = c.hp.run(c.shelf.run(c.x[i]));
      e += y * y;
    }
    sum[i + 1] = sum[i] + e;
  }
  return sum;
}

const lufs = (meanSquare: number) => -0.691 + 10 * Math.log10(meanSquare);

/** Integrated loudness: 400 ms blocks every 100 ms, gated at -70 LUFS and then 10 LU under their mean. */
export function integrated(s: Stereo): number {
  const sum = energy(s);
  const block = Math.round(0.4 * SR);
  const hop = Math.round(0.1 * SR);
  const blocks: number[] = [];
  for (let b = 0; b + block <= s.l.length; b += hop) blocks.push((sum[b + block] - sum[b]) / block);
  const loud = blocks.filter((z) => z > 0 && lufs(z) > -70);
  if (!loud.length) return -Infinity;
  const gate = lufs(loud.reduce((a, z) => a + z, 0) / loud.length) - 10;
  const kept = loud.filter((z) => lufs(z) > gate);
  return lufs(kept.reduce((a, z) => a + z, 0) / kept.length);
}

/** The loudness of the loudest [seconds] of [s]; a shorter sound counts as padded with silence. */
export function loudest(s: Stereo, seconds: number): number {
  const sum = energy(s);
  const n = s.l.length;
  const w = Math.round(seconds * SR);
  if (n <= w) return lufs(sum[n] / w);
  let best = 0;
  for (let i = 0; i + w <= n; i += 16) best = Math.max(best, sum[i + w] - sum[i]);
  return lufs(best / w);
}
