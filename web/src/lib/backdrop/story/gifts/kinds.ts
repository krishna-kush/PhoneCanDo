// The gifts the chapters leave for the floors below: the Spark, the Linux
// machine, the crew and the key. Each is a line run from where its gift is
// on its own floor, back along the deck to a riser at the margin's outer
// edge, down through every floor between, and along the tunnel's deck to
// where it plugs in: everything Little gained, carried down to the dark
// hour that needs it. Which chapter gives what, and when, is the chapter's
// (a Story's `gives` and `takes`, world/frame.ts); gifts/draw.ts draws it.
// Pure: points and lengths, no drawing.

import type { P3 } from '../../paint/pen';
import { floorY } from '../../world/building';
import type { Spot } from '../a07/pose';

export type Gift = 'spark' | 'linux' | 'crew' | 'key';

/** Each gift's lane in the riser, from the margin's outer edge in. */
export const LANE: Record<Gift, number> = { spark: 0, linux: 1, crew: 2, key: 3 };
/** How deep the riser stands, behind everyone on the floors, and how much deeper each lane is, so no two lines lie on each other. */
const RISER_Z = 430;
const LANE_Z = 10;
/** The outer lane's px in from the margin's edge, and the step between lanes. */
const EDGE = 16;
const LANE_OUT = 8;
/** How fast a line runs on from its gift, world units a second of the story. */
export const GROW = 1200;

/** A gift's line: its world points from the gift to the plug, the length along it at each, and in all. */
export type Route = { points: P3[]; at: number[]; length: number };

/**
 * The line from a gift [from] on floor [source] to its plug [to] on floor
 * [taker], in a margin [margin] px wide whose world x is [x]: back along the
 * deck to its lane's depth, across to the riser, down, across the tunnel's
 * deck to the plug, and forward into it. Every run is straight along one
 * world axis, as conduit is laid.
 */
export function route(
  x: (out: number, z: number) => number,
  margin: number,
  gift: Gift,
  from: Spot,
  source: number,
  to: Spot,
  taker: number,
): Route {
  const z = RISER_Z + LANE[gift] * LANE_Z;
  const out = Math.max(from.out, margin - EDGE - LANE[gift] * LANE_OUT);
  const top = floorY(source);
  const bottom = floorY(taker);
  const ox = x(from.out, from.z);
  const rx = x(out, z);
  const tx = x(to.out, to.z);
  const points: P3[] = [
    [ox, top, from.z],
    [ox, top, z],
    [rx, top, z],
    [rx, bottom, z],
    [tx, bottom, z],
    [tx, bottom, to.z],
  ];
  const at = [0];
  for (let k = 1; k < points.length; k++) at.push(at[k - 1] + dist(points[k - 1], points[k]));
  return { points, at, length: at[at.length - 1] };
}

const dist = (a: P3, b: P3) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

/**
 * The stretch of a line, as lengths along it, that lies between world y0
 * and y1 (a floor's room, ceiling to deck); null when none does. A line only
 * ever goes down, so it is one stretch.
 */
export function within(r: Route, y0: number, y1: number): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (let k = 1; k < r.points.length; k++) {
    const a = r.points[k - 1][1];
    const b = r.points[k][1];
    const from = Math.max(y0, a);
    const to = Math.min(y1, b);
    if (from > to) continue;
    // Along a deck y stays put; down the riser it grows one to one with length.
    lo = Math.min(lo, a === b ? r.at[k - 1] : r.at[k - 1] + (from - a));
    hi = Math.max(hi, a === b ? r.at[k] : r.at[k - 1] + (to - a));
  }
  return lo <= hi ? [lo, hi] : null;
}

/** The point [s] along a line. */
function pointAt(r: Route, s: number): P3 {
  for (let k = 1; k < r.points.length; k++) {
    if (s > r.at[k] && k < r.points.length - 1) continue;
    const a = r.points[k - 1];
    const b = r.points[k];
    const len = r.at[k] - r.at[k - 1];
    const q = len > 0 ? Math.min(1, Math.max(0, (s - r.at[k - 1]) / len)) : 0;
    return [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q, a[2] + (b[2] - a[2]) * q];
  }
  return r.points[0];
}

/** The line from s0 to s1 along it, as points, its corners kept. */
export function slice(r: Route, s0: number, s1: number): P3[] {
  const out: P3[] = [pointAt(r, s0)];
  for (let k = 1; k < r.points.length - 1; k++) if (r.at[k] > s0 && r.at[k] < s1) out.push(r.points[k]);
  out.push(pointAt(r, s1));
  return out;
}
