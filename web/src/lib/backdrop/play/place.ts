// The playground as it stands this step, for everything that moves the apps
// (physics.ts, follow.ts): the margin's width, the floors and the one the
// camera is on, what stands on each floor, which chutes are locked and what
// one stands on where; and whether a point is over an open chute.

import type { Fixture } from './fixtures/kinds';
import { CHUTE, SIZE, chuteAt } from './toys';

export type Place = {
  /** The margin's width at the apps' depth, world units. */
  span: number;
  floors: number;
  /** The floor the camera is on. */
  here: number;
  /** What stands on each floor, or null. */
  fixtures: (Fixture | null)[];
  /** The floors whose chute is locked shut just now. */
  shut: boolean[];
  /** What one standing on floor i at [d] stands on: its deck, or a plank over it (fixtures/seesaw.ts). */
  deckAt: (i: number, d: number) => number;
};

/** How far off a chute's middle an app can be and still drop in. */
const CATCH = CHUTE / 2 - SIZE / 4;

/** Whether a point [d] out on floor i is over its chute, close enough to drop in, and the chute is open. */
export const overChute = (d: number, i: number, place: Place) =>
  i < place.floors - 1 && !place.shut[i] && Math.abs(d - chuteAt(i, place.span)) < CATCH;
