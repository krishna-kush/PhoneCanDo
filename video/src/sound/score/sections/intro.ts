// The phone left alone: the hook's shape on a muffled square arp, a clock
// of 16th hats, a pad you feel more than hear. No kick.

import { BEAT, BAR } from '../../../timeline/tempo.ts';
import { hat } from '../../drums/hats.ts';
import { seedOf } from '../../synth/rand.ts';
import { pad } from '../../voices/pad.ts';
import { hookArp } from '../figures.ts';
import { chordIn } from '../plan.ts';
import { put, steps, where, type Ctx } from '../play.ts';

export function intro(ctx: Ctx) {
  for (const s of steps(ctx.span)) {
    const { pos, bar, beat } = where(s);
    hookArp(ctx, s, 850, 0.9);
    put(ctx, 'hats', hat({ seed: seedOf('hat', s) }), beat, pos % 4 === 0 ? 0.55 : pos % 2 ? 0.22 : 0.38, 0.3);
    if (pos === 0) {
      const notes = chordIn(ctx.span, bar).tones;
      put(ctx, 'pad', pad({ notes, len: BAR * BEAT, attack: 0.4, release: 0.5, cutoff: 700 }), beat, 0.55);
    }
  }
}
