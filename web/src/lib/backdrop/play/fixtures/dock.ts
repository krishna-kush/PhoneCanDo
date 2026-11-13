// The apps' floor's dock (fixtures/kinds.ts) as the physics meets it: a row
// of squares in the deck, as many as the margin has room for, some with an
// app asleep in them. An app standing still on the deck near a free one
// slides into it and stays, until it is picked up, knocked out or goes off
// after you. It is full once every square holds an awake app. Pure: no
// drawing.

import { clamp } from '../../species/motion';
import { SIZE, across, floorOf, type Toy } from '../toys';
import type { Fixture } from './kinds';

export type Dock = Extract<Fixture, { kind: 'dock' }>;

/** From one square's middle to the next. */
export const SLOT = SIZE + 2;
const MOST = 4;
/** Slower than this, an app can settle into a square; knocked faster, it comes out. */
const SETTLE = 140;

/** The squares' middles along the dock, in a margin [span] wide. */
export function slots(fx: Dock, span: number): number[] {
  const a = across(span, fx.at);
  const b = across(span, fx.to);
  const n = clamp(Math.floor((b - a) / SLOT), 1, MOST);
  const mid = (a + b) / 2;
  return Array.from({ length: n }, (_, k) => mid + (k - (n - 1) / 2) * SLOT);
}

/** Keeps a toy standing on the deck of floor [i] in its square, or settles it into the nearest free one in reach. */
export function settle(toy: Toy, toys: Toy[], fx: Dock, span: number, i: number, h: number) {
  const at = slots(fx, span);
  if (toy.dock >= at.length || Math.abs(toy.vx) > SETTLE) toy.dock = -1;
  if (toy.dock < 0) {
    const taken = (k: number) => toys.some((o) => o !== toy && o.dock === k && floorOf(o.y) === i);
    let best = -1;
    at.forEach((m, k) => {
      if (!taken(k) && Math.abs(toy.d - m) < SLOT * 0.75 && (best < 0 || Math.abs(toy.d - m) < Math.abs(toy.d - at[best]))) best = k;
    });
    if (best < 0 || Math.abs(toy.vx) > SETTLE) return;
    toy.dock = best;
    toy.squashV += 2;
  }
  toy.d += (at[toy.dock] - toy.d) * Math.min(1, h * 18);
  toy.vx = 0;
}

/** How many of the dock's squares on floor [i] hold an awake app, of how many. */
export function filled(toys: Toy[], fx: Dock, span: number, i: number): [number, number] {
  const n = slots(fx, span).length;
  const k = new Set(toys.filter((o) => o.awake && o.dock >= 0 && o.dock < n && floorOf(o.y) === i).map((o) => o.dock)).size;
  return [k, n];
}
