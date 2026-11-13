// The apps' playground in the left margin: the reader's side of the page,
// where no story is told and you play instead. The phone's apps and a few
// A-series cousins lie asleep on the floors, a few to a floor, some in
// stacks (layout.ts). Tap one awake, then throw it at the others: only a
// hit wakes a sleeper. Each has a trick once it is awake (kinds.ts). A
// throw bounces off the walls and stacks on the others; drop one down a
// floor's chute and it lands on the floor below. The ones you woke follow
// you down the page, a chute at a time, and wait by Mom's house at the end.
// Some floors have one thing more to throw them at (play/fixtures/).
//
// Positions are world units at the depth they all stand at, Z: `d` out from
// the sheet's edge (leftwards), `y` down the building, as world/building.ts
// measures it. Nothing here draws or touches the DOM.

import type { Look } from '../species/look';
import { PITCH, SLAB, floorY } from '../world/building';
import type { ToyKind } from './kinds';

/** Every app's side, the depth they all stand at, and a chute's side. */
export const SIZE = 28;
export const Z = 150;
export const CHUTE = 56;
// How far an app keeps from either wall of the margin: more than the eye
// moving across ever slides it (camera.ts), so it never goes under the sheet.
const INSET = 18;

export type Box = { x0: number; y0: number; x1: number; y1: number };

export type Toy = {
  name: string;
  kind: ToyKind;
  /** A cousin's look; null for an app. */
  look: Look | null;
  /** Out from the sheet's edge; NaN until the margin is known, then placed at `start` of the way across. */
  d: number;
  start: number;
  /** Its feet. */
  y: number;
  vx: number;
  vy: number;
  awake: boolean;
  held: boolean;
  /** The deck whose chute (or the hole it dug) it is going through, or -1; and whether it is going up it, flung from below. */
  chute: number;
  up: boolean;
  /** Where the hole it is digging through a deck is; NaN when it goes by the chute. */
  hole: number;
  /** On a deck or on another app, as of the last step. */
  grounded: boolean;
  /** How far it moved in the last step, world units: shoved against a jam, it can have speed and go nowhere. */
  shift: number;
  /** Squash (over 0, flattened) and stretch (under 0), and how fast that is changing. */
  squash: number;
  squashV: number;
  /** How far it has walked, for its steps; how far its glyph has turned, rolling. */
  walked: number;
  spin: number;
  /** Seconds left of its own doing (a dance, a run), from when it was woken or thrown. */
  energy: number;
  /** Seconds into its dance's beat; seconds since it last bounced off a deck. */
  beat: number;
  bounced: number;
  /** Seconds before a hit can send another message. */
  cool: number;
  /** Where it dug through a deck, and how much longer the hole shows (seconds). */
  dug: { i: number; d: number; left: number } | null;
  /** The dock's square it sits in, or -1. */
  dock: number;
  /** A spark of its own, caught under the Spark, and how much longer that moment shows (seconds). */
  spark: boolean;
  lit: number;
  /** A hard hat, from digging in the pit; how long it has dug so far, -1 when it isn't in the pit; and whether it is on its way out, until it lands. */
  hat: boolean;
  dig: number;
  climbing: boolean;
  /** Its screen box as last drawn, for picking it up; null when it wasn't drawn. */
  box: Box | null;
};

/** The floor whose deck a point at world y stands on or is over. */
export const floorOf = (y: number) => Math.max(0, Math.ceil(y / PITCH) - 1);

/** The underside of the slab over floor i: the glass, over the first. */
export const ceilingOf = (i: number) => (i === 0 ? 0 : floorY(i - 1) + SLAB);

/** The nearest and furthest an app's middle comes to the sheet in a margin [span] wide. */
export function walls(span: number): [number, number] {
  const lo = SIZE / 2 + INSET;
  return [lo, Math.max(lo, span - SIZE / 2 - INSET)];
}

/** Out from the sheet, [share] of the way from the near wall to the far one. */
export function across(span: number, share: number): number {
  const [lo, hi] = walls(span);
  return lo + (hi - lo) * share;
}

/** Where floor i's chute is, as a share of the way across: by the far wall and the near one in turn, so a fall lands across from the next. */
export const chuteShare = (i: number) => (i % 2 === 0 ? 0.78 : 0.22);

export const chuteAt = (i: number, span: number) => across(span, chuteShare(i));
