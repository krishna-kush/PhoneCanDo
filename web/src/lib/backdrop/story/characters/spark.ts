// The Spark: a mind born on the phone, the smallest of the A-series. A tiny
// unit in amber with a glow that breathes and two glints going round it;
// once it finds Little it rides on its head for the rest of the story, and
// it is the light in the tunnel.

import type { Pen } from '../../paint/pen';
import { drawUnit } from '../../paint/unit';
import { BARE } from '../../../../data/wear';
import type { Look } from '../../species/look';

export const SPARK: Look = { size: 10, pose: 'square', swap: true, eyes: 'dot', wear: BARE, serial: 'A-00' };

/** The Spark with its feet at (x, y), glowing; returns where its glow is centred. */
export function drawSpark(pen: Pen, x: number, y: number, z: number, t: number, gaze: readonly [number, number] = [0, -0.4]) {
  const { pal } = pen;
  const S = SPARK.size;
  const cy = y - S * 0.7;
  const breath = 0.5 + 0.5 * Math.sin(t * 2.4);
  pen.faded(0.16 + 0.12 * breath, () => pen.circle(x, cy, z, S * (1.8 + 0.4 * breath), pal.accent));
  pen.faded(0.3, () => pen.circle(x, cy, z, S * 1.05, pal.accent));
  // Two glints going round it.
  for (let k = 0; k < 2; k++) {
    const a = t * 1.3 + k * Math.PI;
    const gx = x + Math.cos(a) * S * 1.5;
    const gy = cy + Math.sin(a) * S * 0.9;
    const g = S * 0.22 * (0.6 + 0.4 * Math.sin(t * 5 + k * 2));
    pen.line([gx - g, gy, z], [gx + g, gy, z], pal.accent);
    pen.line([gx, gy - g, z], [gx, gy + g, z], pal.accent);
  }
  drawUnit(pen, SPARK, {
    x,
    y,
    z,
    lift: 0,
    sx: 1,
    sy: 1 + 0.05 * breath,
    pose: 'square',
    eyes: (t * 0.9) % 4 < 0.12 ? 'shut' : 'dot',
    gaze,
    grey: false,
  });
  return { x, y: cy, z };
}
