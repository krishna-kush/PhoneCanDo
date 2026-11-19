// A rectangle pulled out of square: the projective map that takes a [w] by
// [h] box onto any four corners, as a CSS matrix3d, so a scene can be drawn
// on a sheet whose corners are dragged one by one. Pure.

export type Pt = readonly [number, number];

/** The map from the unit square onto [q] (top left, top right, bottom right, bottom left): x' = (a u + b v + c) / (g u + h v + 1), y' likewise with d, e, f. */
export function squareTo(q: readonly [Pt, Pt, Pt, Pt]) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = det ? (dx3 * dy2 - dx2 * dy3) / det : 0;
  const h = det ? (dx1 * dy3 - dx3 * dy1) / det : 0;
  return { a: x1 - x0 + g * x1, b: x3 - x0 + h * x3, c: x0, d: y1 - y0 + g * y1, e: y3 - y0 + h * y3, f: y0, g, h };
}

/** Where [p] of the unit square lands under [m]. */
export function mapPoint(m: ReturnType<typeof squareTo>, [u, v]: Pt): [number, number] {
  const z = m.g * u + m.h * v + 1;
  return [(m.a * u + m.b * v + m.c) / z, (m.d * u + m.e * v + m.f) / z];
}

/** A CSS transform (from a 0 0 origin) taking a [w] by [h] box onto [q]. */
export function quadTransform(w: number, h: number, q: readonly [Pt, Pt, Pt, Pt]): string {
  const m = squareTo(q);
  const cols = [m.a / w, m.d / w, 0, m.g / w, m.b / h, m.e / h, 0, m.h / h, 0, 0, 1, 0, m.c, m.f, 0, 1];
  return `matrix3d(${cols.map((n) => +n.toFixed(8)).join(',')})`;
}
