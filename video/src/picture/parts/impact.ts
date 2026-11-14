// The camera feeling the sound: every hit on the timeline (an impact, a
// slam, a stamp) shakes the frame and the big ones flash it, read from the
// same cues the sound plays, so picture and sound hit together.

import type { Placed } from '../../timeline/cues.ts';
import type { Sfx } from '../../timeline/sfx.ts';
import { shake } from '../../motion/noise.ts';

/** How hard each sound shakes the frame, in u, and how much it flashes. */
const HITS: Partial<Record<Sfx, { shake: number; flash: number }>> = {
  impact: { shake: 1.8, flash: 0.2 },
  slam: { shake: 0.7, flash: 0 },
  stamp: { shake: 0.55, flash: 0 },
  lock: { shake: 0.8, flash: 0 },
  denied: { shake: 0.5, flash: 0 },
  land: { shake: 0.35, flash: 0 },
};

export type Impacts = (beat: number) => { x: number; y: number; r: number; flash: number };

export function makeImpacts(cues: readonly Placed[]): Impacts {
  const hits = cues.flatMap((c) => {
    const h = HITS[c.sfx];
    return h ? [{ at: c.at, shake: h.shake * Math.min(1.2, c.gain ?? 1), flash: h.flash }] : [];
  });
  return (beat) => {
    let amount = 0;
    let flash = 0;
    for (const h of hits) {
      if (beat < h.at || beat > h.at + 2) continue;
      amount += h.shake * Math.exp(-7 * (beat - h.at));
      flash = Math.max(flash, h.flash * Math.exp(-12 * (beat - h.at)));
    }
    return { ...shake(beat, amount, 11), flash };
  };
}
