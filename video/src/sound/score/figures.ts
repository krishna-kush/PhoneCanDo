// Figures more than one section plays: the arp that traces the hook before
// it is heard, and a snare roll that tightens toward a drop.

import { snare } from '../drums/snare.ts';
import { seedOf } from '../synth/rand.ts';
import { pluck } from '../voices/pluck.ts';
import { hookAt } from './hook.ts';
import { chordIn } from './plan.ts';
import { put, STEP_S, where, type Ctx } from './play.ts';

/**
 * The hook's shape on a square arp: on each of its onsets the hook's own
 * note, between them the chord's tones, quiet. [cutoff] muffles it.
 */
export function hookArp(ctx: Ctx, s: number, cutoff: number, vel: number) {
  const { pos, bar, beat } = where(s);
  const chord = chordIn(ctx.span, bar);
  const note = hookAt(bar - ctx.span.anchor, pos);
  const pan = pos % 2 ? 0.3 : -0.3;
  if (note) {
    put(ctx, 'arp', pluck({ midi: note[1], len: STEP_S * 0.9, cutoff, decay: 0.12 }), beat, vel, pan);
  } else {
    const midi = chord.tones[pos % chord.tones.length] + 12;
    put(ctx, 'arp', pluck({ midi, len: STEP_S * 0.6, cutoff, decay: 0.05 }), beat, vel * 0.35, -pan);
  }
}

/**
 * A snare roll over [from, to) beats: 8ths, then 16ths, then 32nds, louder
 * as it goes. [split] is where it moves up, as shares of the way through.
 */
export function snareRoll(ctx: Ctx, start: number, to: number, split: readonly [number, number] = [0.5, 0.75]) {
  // On the video's 32nd grid, wherever the roll starts.
  const from = Math.ceil(start * 8 - 1e-9) / 8;
  for (let k = 0; ; k++) {
    const beat = from + k / 8;
    if (beat >= to - 1e-9) break;
    const u = (beat - from) / (to - from);
    const every = u < split[0] ? 4 : u < split[1] ? 2 : 1;
    if (k % every) continue;
    put(ctx, 'drums', snare({ tone: 175 + 70 * u, seed: seedOf('roll', k, from) }), beat, 0.22 + 0.78 * u ** 1.5);
  }
}
