// Held breath: no drums, a heartbeat thumping on every beat (lub, then a
// softer dub), a dark pad an octave down whose filter breathes, a sub
// under it.

import { BEAT, BAR } from '../../../timeline/tempo.ts';
import { thump } from '../../drums/kick.ts';
import { sampleOf } from '../../rate.ts';
import { seedOf } from '../../synth/rand.ts';
import { bass } from '../../voices/bass.ts';
import { pad } from '../../voices/pad.ts';
import { chordIn } from '../plan.ts';
import { put, steps, where, type Ctx } from '../play.ts';

export function breakdown(ctx: Ctx) {
  for (const s of steps(ctx.span)) {
    const { pos, bar, beat } = where(s);
    if (pos % 4 === 0) {
      put(ctx, 'kick', thump(seedOf('lub', s)), beat, 0.8);
      put(ctx, 'kick', thump(seedOf('dub', s)), beat + 0.3, 0.45);
      ctx.pumps.push({ at: sampleOf(beat), depth: 0.35 });
    }
    if (pos === 0) {
      const chord = chordIn(ctx.span, bar);
      const len = Math.min(BAR, ctx.span.to - beat) * BEAT;
      const notes = chord.tones.map((m) => m - 12);
      const cutoff = (t: number) => 650 + 250 * Math.sin(2 * Math.PI * 0.6 * t);
      put(ctx, 'pad', pad({ notes, len, attack: 0.35, release: 0.6, cutoff, detune: 12 }), beat, 1.1);
      put(ctx, 'bass', bass({ midi: chord.root, len: len * 0.95, cutoff: 140, sweep: 0, sub: 0.9 }), beat, 0.5);
    }
  }
}
