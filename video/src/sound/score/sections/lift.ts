// Climbing back: a kick on every beat, an 8th bass pulse on E, a chord
// whose filter sweeps from murk to air, and a snare roll from 8ths to 32nds.

import { BEAT } from '../../../timeline/tempo.ts';
import { bass } from '../../voices/bass.ts';
import { pad } from '../../voices/pad.ts';
import { snareRoll } from '../figures.ts';
import { chordIn } from '../plan.ts';
import { kickAt, put, STEP_S, steps, where, type Ctx } from '../play.ts';

export function lift(ctx: Ctx) {
  const { from, to } = ctx.span;
  const long = to - from;
  for (const s of steps(ctx.span)) {
    const { pos, bar, beat } = where(s);
    const chord = chordIn(ctx.span, bar);
    const u = (beat - from) / long;
    if (pos % 4 === 0) kickAt(ctx, beat, 0.75 + 0.2 * u);
    if (pos % 2 === 0) put(ctx, 'bass', bass({ midi: chord.root, len: STEP_S * 1.4, cutoff: 300 + 900 * u, sweep: 1500 }), beat, 0.5 + 0.35 * u);
    if (beat === from || pos === 0) {
      const cutoff = (t: number) => 300 * (8000 / 300) ** Math.min(1, u + t / (long * BEAT));
      put(ctx, 'pad', pad({ notes: chord.tones, len: (to - beat) * BEAT, attack: 0.05, release: 0.03, cutoff, q: 1.4 }), beat, 0.75);
    }
  }
  snareRoll(ctx, from, to, [1 / 3, 2 / 3]);
}
