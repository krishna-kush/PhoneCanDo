// The backdrop's camera: a pinhole a distance d in front of the page plane
// (z = 0), looking in. World units are CSS px on that plane. Up and down, a
// thing on it moves one to one with the camera and anything deeper moves
// less: that difference is the parallax. Across, the page is a window: as
// the eye moves sideways everything slides the way it goes, the deepest
// most and the page plane only a little (FRONT), so the margin you point
// into eases outward and its words never slide under the sheet. x grows
// right, y down, z away from the viewer.

export type Camera = {
  /** The eye, across: how far it has moved from the view's centre. */
  x: number;
  /** The world point the view is centred on, on the page plane, down. */
  y: number;
  /** Distance from the camera to the page plane. */
  d: number;
  /** The view's centre on screen, in CSS px. */
  cx: number;
  cy: number;
};

/** A world point on screen: CSS px, and how much its depth shrinks it. */
export type Dot = { x: number; y: number; s: number };

/** How far the page plane slides across with the eye, of what the deepest things do. */
const FRONT = 0.36;

export const scaleAt = (cam: Camera, z: number) => cam.d / (cam.d + z);

// The view slides with the eye, and the eye itself moves a little less, so
// the page plane is left FRONT of the eye's move.
const eye = (cam: Camera) => cam.x * (1 - FRONT);

export function project(cam: Camera, x: number, y: number, z: number): Dot {
  const s = scaleAt(cam, z);
  return { x: cam.cx + cam.x + (x - eye(cam)) * s, y: cam.cy + (y - cam.y) * s, s };
}

/** The world point at depth z that lands on screen point (sx, sy): project's inverse. */
export function unproject(cam: Camera, sx: number, sy: number, z: number) {
  const s = scaleAt(cam, z);
  return { x: eye(cam) + (sx - cam.cx - cam.x) / s, y: cam.y + (sy - cam.cy) / s };
}

/**
 * The world x at depth z that lands `out` px outside a sheet edge (at screen
 * x [edge]) while the camera is centred. [side] is -1 for the left margin,
 * where out runs leftwards, and 1 for the right.
 */
export const edgeX = (cam: Camera, edge: number, side: -1 | 1, out: number, z: number) =>
  (edge + side * out - cam.cx) / scaleAt(cam, z);
