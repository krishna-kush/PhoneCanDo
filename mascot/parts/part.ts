// How a part a unit wears is written down: marks on its front block, each a
// rect, shape, arc or line at places relative to that block, so one part
// fits every shape and size and draws the same on a canvas, in SVG or in
// React Native. A place is a share of the block's width (across) or height
// (down) plus a share of its short side, S; a bare number is S only. x 0 is
// the block's left edge, y 0 its top: a hat lives above y 0.

/** A place or length along one axis: S only, or [share of the block's width or height, S]. */
export type At = number | readonly [number, number];
export type Point = readonly [At, At];

/**
 * What a mark is painted with. `wear` is the page's own ink (light on dark,
 * dark on light), for what stands out against the page; `red` and `amber`
 * the brand's two; `front` and `back` the ink of the unit's front or back
 * block, whichever its swap makes them; `eye` the eyes' white; `dark` the
 * screens' near black, for what lies on the block (ties, frames).
 */
export type Ink = 'wear' | 'red' | 'amber' | 'front' | 'back' | 'eye' | 'dark';

export type Paint = {
  fill?: Ink;
  stroke?: Ink;
  /** The stroke's width, in S. */
  width?: number;
  /** How opaque, 0 to 1. */
  alpha?: number;
  /** Turned round when the unit looks the other way: a visor, a tail. */
  follow?: boolean;
  /**
   * Laid on an eye instead of the block, its places shares of the open
   * eye's box plus S: on `each` eye, or only the `one` on the right (side
   * on, the only one).
   */
  eye?: 'each' | 'one';
};

export type Mark =
  | ({ rect: readonly [x: At, y: At, w: At, h: At] } & Paint)
  | ({ poly: readonly Point[] } & Paint)
  /** Part of an ellipse: its centre, its radii across and down, and degrees from 3 o'clock, clockwise (y runs down). */
  | ({ arc: readonly [x: At, y: At, rx: At, ry: At, from: number, to: number] } & Paint)
  | ({ line: readonly [Point, Point] } & Paint);

/** Where a part sits: on its head, at its neck, or on its face. */
export type Slot = 'hat' | 'neck' | 'face';

export type Part = {
  slot: Slot;
  /** What it is, in a word or two. */
  label: string;
  /** Face on. */
  front: readonly Mark[];
  /** Side on, turned to the right (mirrored for the left); the front's when left out. */
  side?: readonly Mark[];
  /** From behind; the front's when left out for a hat, nothing for a neck or face part. */
  back?: readonly Mark[];
};

/** A circle of radius [r] S. */
export const circle = (x: At, y: At, r: number, paint: Paint): Mark => ({ arc: [x, y, r, r, 0, 360], ...paint });
