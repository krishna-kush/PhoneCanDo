// The score played out: every span of the plan on its tracks, and the
// kicks the pumped tracks duck under.

import { PLAY } from './sections/index.ts';
import type { Plan } from './plan.ts';
import type { Pump } from './play.ts';
import { tracksOf, type Tracks } from './tracks.ts';

export function arrange(plan: Plan, n: number): { tracks: Tracks; pumps: Pump[] } {
  const tracks = tracksOf(n);
  const pumps: Pump[] = [];
  for (const span of plan.spans) PLAY[span.kind]({ tracks, pumps, span });
  pumps.sort((a, b) => a.at - b.at);
  return { tracks, pumps };
}
