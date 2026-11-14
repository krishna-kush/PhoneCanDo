// The endless zoom's arithmetic. A scene ends by diving into a portal in it
// (a screen, a pupil, a full stop); the next scene is already there inside
// it, shrunk to fit, maybe turned. The camera spirals about the one point
// that brings that frame to fill ours exactly as the dive ends (scaling up
// and turning back by the frame's own turn, together), so the hand-over to
// the next scene is seamless. Run backwards, the same move pulls out of a
// portal instead. Pure: px in, px out.

export type Shape = 'box' | 'circle';

/** A portal's box in the frame, in px, before it is turned. */
export type Box = { x: number; y: number; w: number; h: number };

export type Dive = {
  /** How small the next scene sits in the portal: its frame is r of ours. */
  r: number;
  /** The next scene's frame inside the portal, in px from the portal's own corner, before the turn. */
  inner: Box;
  /** The point the camera spirals about, in px. */
  fx: number;
  fy: number;
  /** The camera's scale now. */
  scale: number;
  /** The camera's turn now, in degrees. */
  turn: number;
};

/**
 * The dive into [portal] (a [shape], turned [angle] degrees about its middle)
 * of a [w] x [h] frame, [k] of the way in (0 at the start, 1 when the next
 * scene fills the frame). A box holds the next frame fitted inside it; a
 * circle, inscribed, so that once the circle has grown past the frame's
 * corners nothing of ours is left. A whole turn (360) spirals the camera in
 * through a circle and lands it upright.
 */
export function diveInto(portal: Box, shape: Shape, w: number, h: number, k: number, angle = 0): Dive {
  const r = shape === 'circle' ? portal.w / Math.hypot(w, h) : Math.min(portal.w / w, portal.h / h);
  const inner = { x: (portal.w - r * w) / 2, y: (portal.h - r * h) / 2, w: r * w, h: r * h };
  // The inner frame sits at p -> c + rR(p - m), c the portal's middle and m
  // the frame's; the camera's fixed point is that map's: (I - rR) f = c - rRm.
  const a = (angle * Math.PI) / 180;
  const rc = r * Math.cos(a);
  const rs = r * Math.sin(a);
  const ux = portal.x + portal.w / 2 - (rc * w - rs * h) / 2;
  const uy = portal.y + portal.h / 2 - (rs * w + rc * h) / 2;
  const det = (1 - rc) ** 2 + rs ** 2;
  return { r, inner, fx: ((1 - rc) * ux - rs * uy) / det, fy: (rs * ux + (1 - rc) * uy) / det, scale: r ** -k, turn: -angle * k };
}

/** The box a turned rectangle had before its [angle] turn, from the box round it as drawn (near a right angle or a straight one). */
export function unturn(round: Box, angle: number): Box {
  const a = (angle * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  const d = c * c - s * s;
  if (Math.abs(d) < 0.2) return round;
  const w = (round.w * c - round.h * s) / d;
  const h = (round.h * c - round.w * s) / d;
  return { x: round.x + (round.w - w) / 2, y: round.y + (round.h - h) / 2, w, h };
}
