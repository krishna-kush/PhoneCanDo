// The drop and the finale: four on the floor, a clap on 2 and 4, open hats
// on the offbeats, an offbeat bass that jumps an octave on the last, the
// bar's chord pumping under the kick and the hook on top. The finale is
// the same groove bigger: the hook an octave up over itself, a crash on
// every bar, the pad brighter.

import { BEAT, BAR } from '../../../timeline/tempo.ts';
import { crash } from '../../drums/crash.ts';
import { hat } from '../../drums/hats.ts';
import { clap, snare } from '../../drums/snare.ts';
import { seedOf } from '../../synth/rand.ts';
import { bass } from '../../voices/bass.ts';
import { lead } from '../../voices/lead.ts';
import { pad } from '../../voices/pad.ts';
import { hookAt, hookBefore } from '../hook.ts';
import { chordIn } from '../plan.ts';
import { kickAt, put, STEP_S, steps, where, type Ctx } from '../play.ts';

/** The hats' level on each 16th of a beat: downbeat, e, (open on and), a. */
const HAT = [0.42, 0.2, 0, 0.24];

function groove(ctx: Ctx, big: boolean) {
  const first = Math.ceil(ctx.span.from * 4 - 1e-9);
  for (const s of steps(ctx.span)) {
    const { pos, bar, beat } = where(s);
    const chord = chordIn(ctx.span, bar);
    const cycle = bar - ctx.span.anchor;
    const turn = ((cycle % 4) + 4) % 4 === 3;

    // The first beat lands hard: a long kick and a crash.
    if (s === first) {
      kickAt(ctx, beat, 1.2, { decay: 0.32 });
      put(ctx, 'crash', crash({ seed: seedOf('crash', s) }), beat, 1);
    } else if (pos % 4 === 0) kickAt(ctx, beat, 1);
    if (pos === 0 && s !== first && (big || ((cycle % 4) + 4) % 4 === 0)) put(ctx, 'crash', crash({ seed: seedOf('crash', s), decay: 0.55 }), beat, 0.6);

    if (pos === 4 || pos === 12) {
      put(ctx, 'drums', clap({ seed: seedOf('clap', s) }), beat, 0.9);
      put(ctx, 'drums', snare({ seed: seedOf('snare', s) }), beat, 0.32);
    }
    // A fill into the next four bars.
    if (turn && pos >= 13) put(ctx, 'drums', snare({ seed: seedOf('fill', s), tone: 190 + 12 * (pos - 13) }), beat, 0.4 + 0.15 * (pos - 13));

    if (pos % 4 === 2) put(ctx, 'hats', hat({ open: true, seed: seedOf('open', s) }), beat, big ? 0.62 : 0.55, -0.2);
    else put(ctx, 'hats', hat({ seed: seedOf('hat', s) }), beat, HAT[pos % 4] * (big ? 1.15 : 1), 0.25);

    if (pos % 4 === 2) put(ctx, 'bass', bass({ midi: chord.root + (pos === 14 ? 12 : 0), len: STEP_S * 1.7 }), beat, 1);

    if (pos === 0 || s === first) {
      const rest = Math.min(BAR - (beat % BAR), ctx.span.to - beat);
      const notes = big ? [...chord.tones, chord.tones[0] + 12] : chord.tones;
      put(ctx, 'pad', pad({ notes, len: rest * BEAT, attack: 0.006, release: 0.12, cutoff: big ? 5200 : 3400 }), beat, 1);
    }

    const note = hookAt(cycle, pos);
    if (note) {
      const [, midi, len] = note;
      // A short slide in from the note before, when it runs right up to this one and is near.
      const prev = hookBefore(cycle, pos);
      const slide = prev && s !== first && Math.abs(prev[1] - midi) <= 5 ? prev[1] : undefined;
      const hold = len * STEP_S * 0.92;
      if (big) {
        put(ctx, 'lead', lead({ midi: midi + 12, len: hold, from: slide === undefined ? undefined : slide + 12, cutoff: 7500 }), beat, 0.62);
        put(ctx, 'lead', lead({ midi, len: hold, from: slide, duty: 0.5 }), beat, 0.75);
      } else put(ctx, 'lead', lead({ midi, len: hold, from: slide }), beat, 1);
    }
  }
}

export const drop = (ctx: Ctx) => groove(ctx, false);

export const finale = (ctx: Ctx) => groove(ctx, true);
