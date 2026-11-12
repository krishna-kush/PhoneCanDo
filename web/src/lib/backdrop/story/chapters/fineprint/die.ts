// A die as a real cube: turned in 3D, its faces lit by which way they face,
// square pips, and only the faces turned toward the camera drawn.

import type { P3, Pen } from '../../../paint/pen';

type V3 = [number, number, number];

/** Turned about z (a roll across the floor), then about x (a tumble toward you). */
function turn([x, y, z]: V3, ax: number, az: number): V3 {
  const cz = Math.cos(az);
  const sz = Math.sin(az);
  const x1 = x * cz - y * sz;
  const y1 = x * sz + y * cz;
  const cx = Math.cos(ax);
  const sx = Math.sin(ax);
  return [x1, y1 * cx - z * sx, y1 * sx + z * cx];
}

// Each face: its normal, two axes across it, and its pips (opposite faces sum to 7).
const FACES: { n: V3; u: V3; v: V3; pips: number }[] = [
  { n: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0], pips: 1 },
  { n: [0, 0, 1], u: [-1, 0, 0], v: [0, 1, 0], pips: 6 },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], pips: 2 },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], pips: 5 },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], pips: 3 },
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], pips: 4 },
];
const D = 0.27;
const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-D, -D], [D, D]],
  3: [[-D, -D], [0, 0], [D, D]],
  4: [[-D, -D], [D, -D], [-D, D], [D, D]],
  5: [[-D, -D], [D, -D], [0, 0], [-D, D], [D, D]],
  6: [[-D, -D], [D, -D], [-D, 0], [D, 0], [-D, D], [D, D]],
};

/** The die centred at [c], [half] its side, turned (ax, az); returns the number facing the camera. */
export function drawDie(pen: Pen, c: V3, half: number, ax: number, az: number): number {
  const { pal, cam } = pen;
  let facing = 1;
  let most = Infinity;
  for (const f of FACES) {
    const n = turn(f.n, ax, az);
    if (n[2] < most) {
      most = n[2];
      facing = f.pips;
    }
    const centre: V3 = [c[0] + n[0] * half, c[1] + n[1] * half, c[2] + n[2] * half];
    const toCam = [cam.x - centre[0], cam.y - centre[1], -cam.d - centre[2]];
    if (n[0] * toCam[0] + n[1] * toCam[1] + n[2] * toCam[2] <= 0) continue;
    const u = turn(f.u, ax, az);
    const v = turn(f.v, ax, az);
    const point = (a: number, b: number): P3 => [
      centre[0] + (u[0] * a + v[0] * b) * half,
      centre[1] + (u[1] * a + v[1] * b) * half,
      centre[2] + (u[2] * a + v[2] * b) * half,
    ];
    pen.shape([point(-1, -1), point(1, -1), point(1, 1), point(-1, 1)], n[1] < -0.5 ? pal.panel : pal.panel2, pal.ink);
    const p = 0.11;
    for (const [a, b] of PIPS[f.pips]) {
      pen.shape([point(a - p, b - p), point(a + p, b - p), point(a + p, b + p), point(a - p, b + p)], f.pips === 1 ? pal.red : pal.fg);
    }
  }
  return facing;
}
