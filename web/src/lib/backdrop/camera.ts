// The backdrop's camera: a pinhole a distance d in front of the page plane
// (z = 0), looking in. World units are CSS px on that plane, so a thing on
// it moves one to one with the camera and anything deeper moves less: that
// difference is the parallax. x grows right, y down, z away from the viewer.

export type Camera = {
  /** The world point the view is centred on, on the page plane. */
  x: number;
  y: number;
  /** Distance from the camera to the page plane. */
  d: number;
  /** The view's centre on screen, in CSS px. */
  cx: number;
  cy: number;
};

/** A world point on screen: CSS px, and how much its depth shrinks it. */
export type Dot = { x: number; y: number; s: number };

export const scaleAt = (cam: Camera, z: number) => cam.d / (cam.d + z);

export function project(cam: Camera, x: number, y: number, z: number): Dot {
  const s = scaleAt(cam, z);
  return { x: cam.cx + (x - cam.x) * s, y: cam.cy + (y - cam.y) * s, s };
}

/**
 * The world x at depth z that lands `out` px outside a sheet edge (at screen
 * x [edge]) while the camera is centred. [side] is -1 for the left margin,
 * where out runs leftwards, and 1 for the right.
 */
export const edgeX = (cam: Camera, edge: number, side: -1 | 1, out: number, z: number) =>
  (edge + side * out - cam.cx) / scaleAt(cam, z);
