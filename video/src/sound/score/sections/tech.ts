// The machine room: kicks with a skip in every other bar, rimshots off the
// grid, glitchy 16th hats that sometimes double, a 16th bass riff and a
// fast square arp. No hook.

import { BEAT, BAR } from '../../../timeline/tempo.ts';
import { hat } from '../../drums/hats.ts';
import { clap, rim } from '../../drums/snare.ts';
import { rand, seedOf } from '../../synth/rand.ts';
import { bass } from '../../voices/bass.ts';
import { pad } from '../../voices/pad.ts';
import { pluck } from '../../voices/pluck.ts';
import { chordIn } from '../plan.ts';
import { kickAt, put, STEP_S, steps, where, type Ctx } from '../play.ts';

/** The bass riff over the root, a 16th each: semitones up. */
const RIFF = [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 0, 12, 7, 12];
const RIMS = [3, 6, 11, 14];

export function tech(ctx: Ctx) {
  const r = rand(seedOf('tech', ctx.span.from));
  for (const s of steps(ctx.span)) {
    const { pos, bar, beat } = where(s);
    const chord = chordIn(ctx.span, bar);

    if (pos % 4 === 0 || (bar % 2 === 1 && pos === 10)) kickAt(ctx, beat, 0.95);
    if (pos === 4 || pos === 12) put(ctx, 'drums', clap({ seed: seedOf('clap', s) }), beat, 0.55);
    if (RIMS.includes(pos)) put(ctx, 'drums', rim({ seed: seedOf('rim', s) }), beat, 0.55, pos % 2 ? 0.3 : -0.3);

    const pan = pos % 2 ? 0.35 : -0.15;
    put(ctx, 'hats', hat({ seed: seedOf('hat', s) }), beat, 0.18 + 0.38 * r(), pan);
    if (pos % 8 === 7 && r() < 0.5) put(ctx, 'hats', hat({ seed: seedOf('ratchet', s) }), beat + 0.125, 0.3, -pan);

    put(ctx, 'bass', bass({ midi: chord.root + RIFF[pos], len: STEP_S * 0.75, cutoff: 320, sweep: 1900 }), beat, pos % 2 ? 0.7 : 0.95);

    // Up through the chord and the octave above, three notes against four.
    const k = s % 6;
    const midi = chord.tones[k % 3] + 12 * Math.floor(k / 3) + 12;
    put(ctx, 'arp', pluck({ midi, len: STEP_S * 0.7, duty: 0.25, cutoff: 5000, decay: 0.05 }), beat, 0.8, pos % 2 ? 0.4 : -0.4);

    if (pos === 0) {
      const rest = Math.min(BAR, ctx.span.to - beat);
      put(ctx, 'pad', pad({ notes: chord.tones, len: rest * BEAT, attack: 0.05, release: 0.2, cutoff: 1100 }), beat, 0.5);
    }
  }
}
