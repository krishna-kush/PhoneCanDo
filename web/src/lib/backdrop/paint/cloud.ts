// A cloud the manual's way: square puffs, one dashed outline round all of
// them, filled with the page's ground so whatever is behind stays behind.

import type { Pen } from './pen';

// Puffs as [x, y, w, h], in widths of the cloud, from its middle.
const PUFFS: [number, number, number, number][] = [
  [-0.5, -0.06, 1, 0.26],
  [-0.34, -0.3, 0.36, 0.3],
  [-0.02, -0.42, 0.38, 0.42],
  [0.24, -0.22, 0.2, 0.22],
];

/** A cloud [w] wide, its middle at (x, y). */
export function drawCloud(pen: Pen, x: number, y: number, z: number, w: number, dash = true) {
  const { pal } = pen;
  const stroke = dash ? [4, 3] : undefined;
  // Every outline first, then every fill a hair inside it: the fills cover
  // the lines that fall inside another puff, leaving one outline round all.
  for (const [px, py, pw, ph] of PUFFS) pen.rect(x + px * w, y + py * w, pw * w, ph * w, z, undefined, pal.ink, stroke);
  const hair = 1 / pen.scale(z);
  for (const [px, py, pw, ph] of PUFFS) {
    pen.rect(x + px * w + hair, y + py * w + hair, pw * w - hair * 2, ph * w - hair * 2, z, pal.bg);
  }
}
