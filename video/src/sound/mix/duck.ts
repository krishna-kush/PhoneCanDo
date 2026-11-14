// Making room for the sound effects: the music dips under the big ones
// (the drop's hit, slams, stamps, A-01 talking) and gives a little under
// anything else the effects bus is doing.

import type { Placed } from '../../timeline/cues.ts';
import type { Sfx } from '../../timeline/sfx.ts';
import { SR, sampleOf } from '../rate.ts';
import type { Stereo } from '../synth/stereo.ts';

/** How far the music dips under a sound (dB), how long it stays down and how long it takes back (s). */
type Dip = { db: number; hold: number; release: number };

const DIPS: Partial<Record<Sfx, Dip>> = {
  impact: { db: 7, hold: 0.12, release: 0.7 },
  slam: { db: 4, hold: 0.06, release: 0.25 },
  stamp: { db: 4, hold: 0.06, release: 0.25 },
  lock: { db: 3, hold: 0.1, release: 0.25 },
  denied: { db: 3, hold: 0.2, release: 0.2 },
  chirp: { db: 3, hold: 0.25, release: 0.2 },
  notify: { db: 2, hold: 0.2, release: 0.2 },
  ding: { db: 2, hold: 0.15, release: 0.3 },
  unlock: { db: 2, hold: 0.2, release: 0.3 },
  boing: { db: 1.5, hold: 0.2, release: 0.2 },
};

/** Over this effects level (dB), the music gives way, this much for each dB over, at most MAX. */
const FOLLOW = { from: -26, per: 0.3, max: 2.5 };

const gainOf = (db: number) => 10 ** (-db / 20);

/** The music's gain at each sample, under [cues] and the effects bus [sfx]. */
export function duckCurve(cues: readonly Placed[], sfx: Stereo, n: number): Float32Array {
  const dip = new Float32Array(n);
  const attack = Math.round(0.005 * SR);
  for (const c of cues) {
    const d = DIPS[c.sfx];
    if (!d) continue;
    const at = sampleOf(c.at);
    const db = d.db * Math.min(1, c.gain ?? 1);
    const hold = Math.round(d.hold * SR);
    const release = Math.round(d.release * SR);
    for (let i = -attack; i < hold + release; i++) {
      const k = at + i;
      if (k < 0) continue;
      if (k >= n) break;
      const v = i < 0 ? db * (1 + i / attack) : i < hold ? db : db * (1 - (i - hold) / release);
      if (v > dip[k]) dip[k] = v;
    }
  }
  // A gentle follow of whatever the effects are doing.
  const up = Math.exp(-1 / (0.003 * SR));
  const down = Math.exp(-1 / (0.15 * SR));
  let env = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.max(Math.abs(sfx.l[i]), Math.abs(sfx.r[i]));
    env = x > env ? x + (env - x) * up : x + (env - x) * down;
    const level = 20 * Math.log10(env + 1e-9);
    const follow = Math.min(FOLLOW.max, Math.max(0, (level - FOLLOW.from) * FOLLOW.per));
    if (follow > dip[i]) dip[i] = follow;
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = gainOf(dip[i]);
  return out;
}
