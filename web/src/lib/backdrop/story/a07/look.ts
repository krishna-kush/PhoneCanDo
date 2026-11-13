// Little, unit A-07, the story's lead: a plain cousin you can pick out on
// any floor by the scarf it always wears and its serial over its head. Once
// it finds the Spark, the Spark rides on its head.

import type { Pen } from '../../paint/pen';
import type { Body } from '../../paint/unit';
import type { Look } from '../../species/look';
import { SPARK, drawSpark } from '../characters/spark';
import type { Kit } from './pose';

export const A07: Look = { size: 30, shape: 'square', swap: false, eyes: 'dot', design: 'plain', serial: 'A-07' };

export const NO_KIT: Kit = { spark: false };

/** The scarf, its tail streaming away from where it looks, and the Spark on its head; returns the Spark's glow, if it has it. */
export function drawKit(pen: Pen, b: Body, kit: Kit, t: number, gaze: readonly [number, number]) {
  const { pal } = pen;
  const S = b.size;
  const band = b.top + b.h * 0.62;
  pen.rect(b.left - S * 0.05, band, b.w + S * 0.1, S * 0.15, b.z, pal.fg);
  const back = gaze[0] >= 0 ? -1 : 1;
  const root = back < 0 ? b.left + S * 0.12 : b.left + b.w - S * 0.12;
  const wave = Math.sin(t * 4) * S * 0.06;
  pen.shape(
    [
      [root, band + S * 0.04, b.z],
      [root + back * S * 0.46, band + S * 0.14 + wave, b.z],
      [root + back * S * 0.4, band + S * 0.3 + wave, b.z],
      [root - back * S * 0.04, band + S * 0.15, b.z],
    ],
    pal.fg,
  );
  if (!kit.spark) return null;
  return drawSpark(pen, b.x, b.top, b.z, t, gaze);
}

/** How far above its block its tallest part reaches, for its serial and callouts. */
export const headroom = (kit: Kit) => (kit.spark ? SPARK.size * 1.3 : 0) + A07.size * 0.06;
