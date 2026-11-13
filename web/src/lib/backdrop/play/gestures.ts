// Your hand on the playground's empty floor, not on any app: shaken (the
// pointer held down and swung quickly back and forth), the floor under it
// jolts at every swing back; held still a moment, it starts jiggle mode, as
// a phone's home screen does, when any app can be picked up, sleepers too,
// to set them up where you like. Screen points in CSS px, times in seconds.
// Pure: playground.ts acts on what this says.

/** Held still this long, a press starts jiggle mode; moving more than this many px, it isn't still. */
const HOLD = 0.45;
const STILL = 6;
/** A swing back counts once the hand went this far one way; this many swings within this long, it is a shake. */
const SWING = 10;
const SWINGS = 2;
const WITHIN = 0.7;

export type Press = {
  x: number;
  y: number;
  t: number;
  /** The way the hand is going across (-1, 1; 0 before it has gone either), and how far it has got that way. */
  dir: number;
  edge: number;
  /** When it swung back lately. */
  swings: number[];
  /** It has moved off where it was pressed. */
  moved: boolean;
};

export function startPress(x: number, y: number, t: number): Press {
  return { x, y, t, dir: 0, edge: x, swings: [], moved: false };
}

/** The hand moved to (x, y) at t: whether that was a swing back in a shake. */
export function swung(p: Press, x: number, y: number, t: number): boolean {
  if (Math.hypot(x - p.x, y - p.y) > STILL) p.moved = true;
  if (p.dir === 0) {
    if (Math.abs(x - p.edge) > 2) p.dir = Math.sign(x - p.edge);
    p.edge = x;
    return false;
  }
  if ((x - p.edge) * p.dir >= 0) {
    p.edge = x;
    return false;
  }
  // Turned back: a swing, once it has come back far enough.
  if ((p.edge - x) * p.dir < SWING) return false;
  p.dir = -p.dir;
  p.edge = x;
  p.swings = [...p.swings.filter((s) => t - s < WITHIN), t];
  return p.swings.length >= SWINGS;
}

/** Whether a press has been held still long enough to start jiggle mode. */
export const heldStill = (p: Press, t: number) => !p.moved && t - p.t >= HOLD;
