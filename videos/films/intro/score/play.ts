// What a section plays with: the engine's stage and moves (put, kickAt,
// steps), on the intro's tracks and spans, at the intro's tempo.

import { stepOf, where as whereAt, type Ctx as StageCtx } from '../../../engine/sound/score/play.ts';
import { TEMPO } from '../beats.ts';
import type { Span } from './plan.ts';
import type { TrackId } from './tracks.ts';

export { kickAt, put, steps } from '../../../engine/sound/score/play.ts';

export type Ctx = StageCtx<TrackId, Span>;

/** A 16th, in seconds. */
export const STEP_S = stepOf(TEMPO);

/** Where 16th [s] falls: its place in its bar (0 to 15), its bar and its beat. */
export const where = (s: number) => whereAt(TEMPO, s);
