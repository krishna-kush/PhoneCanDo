// The landing: one big hit (a long kick, a crash, the chord struck), the
// chord left ringing, then a small arp over it fading to nothing a beat
// before the end.

import { BAR, BEAT } from '../../../timeline/tempo.ts';
import { crash } from '../../drums/crash.ts';
import { seedOf } from '../../synth/rand.ts';
import { bass } from '../../voices/bass.ts';
import { pad } from '../../voices/pad.ts';
import { pluck } from '../../voices/pluck.ts';
import { chordIn } from '../plan.ts';
import { kickAt, put, STEP_S, steps, where, type Ctx } from '../play.ts';

/** The arp's walk: which of its notes, a 16th each. */
const WALK = [0, 2, 3, 1, 2, 0, 3, 2];

export function outro(ctx: Ctx) {
  const { from, to } = ctx.span;
  const chord = chordIn(ctx.span, Math.floor(from / BAR));
  kickAt(ctx, from, 1.25, { decay: 0.45 });
  put(ctx, 'crash', crash({ seed: seedOf('crash', from) }), from, 1);
  // Rings for all but the last moment, gone before the file ends.
  const ring = (to - from) * BEAT - 0.6;
  put(ctx, 'pad', pad({ notes: [...chord.tones, chord.tones[1] + 12], len: ring, attack: 0.005, release: 0.5, cutoff: 4500, decay: 1.4 }), from, 1.3);
  put(ctx, 'bass', bass({ midi: chord.root, len: 1.1, cutoff: 300, sweep: 1500, sub: 0.6 }), from, 1);
  for (const m of chord.tones) put(ctx, 'arp', pluck({ midi: m + 12, len: 0.3, cutoff: 5000, decay: 0.25 }), from, 0.5);

  const notes = [72, 74, 76, 79];
  const start = from + 1;
  const end = to - 1;
  for (const s of steps(ctx.span)) {
    const { beat } = where(s);
    if (beat < start || beat >= end) continue;
    const fade = (1 - (beat - start) / (end - start)) ** 1.5;
    const midi = notes[WALK[s % WALK.length]];
    put(ctx, 'arp', pluck({ midi, len: STEP_S * 0.7, cutoff: 3500, decay: 0.08 }), beat, 0.6 * fade, s % 2 ? 0.35 : -0.35);
  }
}
