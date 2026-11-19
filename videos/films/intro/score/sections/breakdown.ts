// Held breath: no drums, a heartbeat thumping on every beat (lub, then a
// softer dub), a dark pad an octave down whose filter breathes, a sub
// under it.

import { BEAT, BAR } from '../../beats.ts';
import { thump } from '../../../../engine/sound/instruments/drums/kick.ts';
import { seedOf } from '../../../../engine/sound/synth/rand.ts';
import { bass } from '../../../../engine/sound/instruments/voices/bass.ts';
import { pad } from '../../../../engine/sound/instruments/voices/pad.ts';
import { chordIn } from '../plan.ts';
import { put, steps, where, type Ctx } from '../play.ts';

export function breakdown(ctx: Ctx) {
  for (const s of steps(ctx.span)) {
    const { pos, bar, beat } = where(s);
    if (pos % 4 === 0) {
      put(ctx, 'kick', thump(seedOf('lub', s)), beat, 0.8);
      put(ctx, 'kick', thump(seedOf('dub', s)), beat + 0.3, 0.45);
      ctx.pumps.push({ at: ctx.clock.sampleOf(beat), depth: 0.35 });
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
