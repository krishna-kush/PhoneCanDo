// The score as the film's `Sound` takes it: its tracks, its plan's notes
// played onto them by the band, and what the mix needs from the plan and
// the harmony.

import type { Change } from '../../../engine/sound/score/plan.ts';
import type { Music } from '../../../engine/sound/sound.ts';
import { play } from './band.ts';
import { chordAt } from './harmony.ts';
import type { Note } from './notes.ts';
import { CHANGES, planOf, type Kind, type Plan } from './plan.ts';
import { NOTES } from './sections/index.ts';
import { TRACKS, type TrackId } from './tracks.ts';

/** Every note [plan] plays, each span's with the span they belong to. */
export const notesOf = (plan: Plan): { span: Plan['spans'][number]; notes: Note[] }[] => plan.spans.map((span) => ({ span, notes: NOTES[span.kind](span) }));

/** The score over [total] beats, its sections changing where [changes] say: the film's own plan when left out. */
export function scoreOf(total: number, changes: readonly Change<Kind>[] = CHANGES): Music<TrackId> {
  const plan = planOf(changes, total);
  return {
    tracks: TRACKS,
    play: (stage) => {
      for (const { span, notes } of notesOf(plan)) play({ ...stage, span }, notes);
    },
    silences: plan.silences,
    stops: plan.stops,
    cuts: plan.cuts,
    chordAt,
  };
}
