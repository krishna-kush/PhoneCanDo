// How the spec plate turns over (PostcardFlip.tsx), in degrees about its
// upright axis: 0 its face, ±180 its back, and on round. A drag follows the
// finger, a card's width for a half turn; let go past a third of a half
// turn, or with a flick, and it finishes the half turn the way it went,
// else it settles back to the side it started from. Pure (zero RN
// imports); worklets, as the pan runs them on the UI thread.

/** How far a drag must go, as a share of a half turn, to finish it. */
const FINISH_AT = 1 / 3;

/** A flick this fast, in degrees a second, finishes the turn however short the drag. */
const FLICK = 450;

/** The side nearest `angle`: the closest whole half turn. */
export function nearestSide(angle: number): number {
  'worklet';
  return Math.round(angle / 180) * 180;
}

/** Where a drag of `dx` across a card `width` wide has turned it, from `start`. */
export function dragAngle(start: number, dx: number, width: number): number {
  'worklet';
  return width > 0 ? start + (dx / width) * 180 : start;
}

/** A finger's speed across a card `width` wide, in degrees a second. */
export function turnSpeed(velocityX: number, width: number): number {
  'worklet';
  return width > 0 ? (velocityX / width) * 180 : 0;
}

/** Where a turn settles once let go: a flick wins, else a third of a half turn decides. */
export function turnTarget(side: number, angle: number, speed: number): number {
  'worklet';
  const moved = angle - side;
  const dir = Math.abs(speed) > FLICK ? Math.sign(speed) : Math.abs(moved) > 180 * FINISH_AT ? Math.sign(moved) : 0;
  return side + dir * 180;
}

/** Whether the plate shows its back at `angle`. */
export function showsBack(angle: number): boolean {
  'worklet';
  return Math.cos((angle * Math.PI) / 180) < 0;
}
