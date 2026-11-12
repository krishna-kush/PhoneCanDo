// Specks drifting up through the building at a few depths: the first cue
// that there is depth at all, as they slide past each other when the camera
// moves. Placed per cell of world space, so none need keeping.

import { noise } from '../seed';
import type { Frame } from './frame';
import { rows, spans } from './reach';

const CELL = 240;
const DEPTHS = [240, 520, 860, 1220];

export function drawMotes(f: Frame) {
  const { pen, t } = f;
  const { pal } = pen;
  for (const z of DEPTHS) {
    const [y0, y1] = rows(f, z);
    for (const [x0, x1] of spans(f, z)) {
      for (let cx = Math.floor(x0 / CELL); cx * CELL < x1; cx++) {
        for (let cy = Math.floor(y0 / CELL) - 1; cy * CELL < y1; cy++) {
          const r1 = noise(cx, cy, z);
          const r2 = noise(cy, z, cx);
          const r3 = noise(z, cx, cy);
          const rise = 6 + r3 * 14;
          const y = cy * CELL + ((((r2 * CELL - t * rise) % CELL) + CELL) % CELL);
          const size = 2 + r3 * 2.5;
          pen.alpha = 0.2 + 0.35 * (0.5 + 0.5 * Math.sin(t * (0.8 + r1) + r2 * 6.28));
          pen.rect((cx + r1) * CELL, y, size, size, z, r1 < 0.16 ? pal.red : pal.ink);
        }
      }
    }
  }
  pen.alpha = 1;
}
