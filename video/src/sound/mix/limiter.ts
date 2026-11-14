// The last guard: a look-ahead limiter on the true peak. Offline, it can
// see each peak coming, so it eases the gain down over the few ms before
// it and lets it back up slowly after, rather than chopping the wave.

import { SR } from '../rate.ts';
import type { Stereo } from '../synth/stereo.ts';
import { peaks } from './truepeak.ts';

/** Keeps [s]'s true peak under [ceiling] (linear), in place. */
export function limit(s: Stereo, ceiling: number, release = 0.08) {
  const n = s.l.length;
  const top = peaks(s);
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) need[i] = top[i] > ceiling ? ceiling / top[i] : 1;

  // The lowest gain needed over the next L samples, then averaged over the last L: down in time for every peak.
  const L = Math.round(0.0025 * SR);
  const ahead = new Float32Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let end = 0;
  for (let j = 0; j < n + L - 1; j++) {
    if (j < n) {
      while (end > head && need[queue[end - 1]] >= need[j]) end--;
      queue[end++] = j;
    }
    const i = j - L + 1;
    if (i < 0) continue;
    while (queue[head] < i) head++;
    ahead[i] = need[queue[head]];
  }
  const rc = 1 - Math.exp(-1 / (release * SR));
  let run = 0;
  let g = 1;
  for (let i = 0; i < n; i++) {
    run += ahead[i] - (i >= L ? ahead[i - L] : 0);
    const eased = (run + Math.max(0, L - 1 - i)) / L;
    g = Math.min(eased, g + (1 - g) * rc);
    s.l[i] *= g;
    s.r[i] *= g;
  }
}
