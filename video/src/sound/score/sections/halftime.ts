// Night: the beat at half speed (kick on 1, snare on 3), soft chords and a
// music box rocking through each one. The second half brightens toward
// morning: the filter opens, the hats double and the box gets an echo an
// octave up.

import { BEAT, BAR } from '../../../timeline/tempo.ts';
import { hat } from '../../drums/hats.ts';
import { clap, snare } from '../../drums/snare.ts';
import { hz } from '../../synth/pitch.ts';
import { seedOf } from '../../synth/rand.ts';
import { bass } from '../../voices/bass.ts';
import { bell } from '../../voices/bell.ts';
import { pad } from '../../voices/pad.ts';
import { chordIn } from '../plan.ts';
import { kickAt, put, steps, where, type Ctx } from '../play.ts';

/** The music box's walk through a chord, an 8th each: which tone, top first. */
const BOX = [2, 1, 0, 1, 2, 1, 0, 1];

export function halftime(ctx: Ctx) {
  const { from, to } = ctx.span;
  for (const s of steps(ctx.span)) {
    const { pos, bar, beat } = where(s);
    const chord = chordIn(ctx.span, bar);
    const u = (beat - from) / (to - from);
    const morning = u >= 0.5;

    if (pos === 0) kickAt(ctx, beat, 0.85, {}, 0.5);
    if (pos === 8) {
      put(ctx, 'drums', snare({ seed: seedOf('snare', s) }), beat, 0.75);
      put(ctx, 'drums', clap({ seed: seedOf('clap', s) }), beat, 0.3);
    }
    if (morning || pos % 2 === 0) put(ctx, 'hats', hat({ seed: seedOf('hat', s) }), beat, pos % 2 ? 0.2 : 0.3, 0.25);

    if (pos === 0) {
      const rest = Math.min(BAR, to - beat);
      put(ctx, 'pad', pad({ notes: chord.tones, len: rest * BEAT, attack: 0.15, release: 0.4, cutoff: 1300 + 3200 * u }), beat, 0.85);
      put(ctx, 'bass', bass({ midi: chord.root, len: rest * BEAT * 0.9, cutoff: 260, sweep: 500, sub: 0.6 }), beat, 0.6);
    }
    if (pos % 2 === 0) {
      const midi = chord.tones[BOX[pos / 2]] + 12;
      put(ctx, 'bell', bell({ freq: hz(midi), ratio: 3.5, index: 1.8, decay: 0.45 }), beat, 0.8, pos % 4 ? 0.25 : -0.25);
      if (morning) put(ctx, 'bell', bell({ freq: hz(midi + 12), ratio: 3.5, index: 1.4, decay: 0.3 }), beat + 0.25, 0.35, 0.4);
    }
  }
}
