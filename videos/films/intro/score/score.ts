// The score as the film's `Sound` takes it: its tracks, every span of the
// plan played onto them, and what the mix needs from the plan.

import type { Music } from '../../../engine/sound/sound.ts';
import { TOTAL } from '../script/scenes.ts';
import { sectionsOf } from '../script/cues.ts';
import { chordAt, planOf } from './plan.ts';
import { PLAY } from './sections/index.ts';
import { TRACKS, type TrackId } from './tracks.ts';

export function scoreOf(): Music<TrackId> {
  const plan = planOf(sectionsOf(), TOTAL);
  return {
    tracks: TRACKS,
    play: (stage) => {
      for (const span of plan.spans) PLAY[span.kind]({ ...stage, span });
    },
    silences: plan.silences,
    stops: plan.stops,
    cuts: plan.cuts,
    chordAt: (beat) => chordAt(plan, beat),
  };
}
