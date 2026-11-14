// Getting ready: the arp's filter opens bar by bar, a kick on every beat
// grows under it, and a snare roll tightens through the last bar.

import { BEAT, BAR } from '../../../timeline/tempo.ts';
import { hat } from '../../drums/hats.ts';
import { seedOf } from '../../synth/rand.ts';
import { pad } from '../../voices/pad.ts';
import { hookArp, snareRoll } from '../figures.ts';
import { chordIn } from '../plan.ts';
import { kickAt, put, steps, where, type Ctx } from '../play.ts';

export function build(ctx: Ctx) {
  const { from, to } = ctx.span;
  const long = to - from;
  for (const s of steps(ctx.span)) {
    const { pos, bar, beat } = where(s);
    const u = (beat - from) / long;
    hookArp(ctx, s, 850 * (9000 / 850) ** u, 0.8 + 0.4 * u);
    if (pos % 4 === 0) kickAt(ctx, beat, 0.55 + 0.35 * u, {}, 0.6);
    put(ctx, 'hats', hat({ seed: seedOf('hat', s) }), beat, (pos % 2 ? 0.2 : 0.32) + 0.25 * u, 0.3);
    if (pos === 0 || beat === from) {
      const rest = Math.min(BAR - (beat % BAR), to - beat);
      const start = u;
      const cutoff = (t: number) => 600 * (6000 / 600) ** Math.min(1, start + t / (long * BEAT));
      put(ctx, 'pad', pad({ notes: chordIn(ctx.span, bar).tones, len: rest * BEAT, attack: 0.08, release: 0.2, cutoff }), beat, 0.6);
    }
  }
  snareRoll(ctx, Math.max(from, to - BAR), to);
}
