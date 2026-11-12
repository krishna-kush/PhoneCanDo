// A-07, the story's lead: a plain cousin you can pick out on any floor by
// the scarf it always wears and its serial over its head. What it picks up
// on the way (a brain, a hard hat, glasses) shows on it from then on.

import type { Pen } from '../../paint/pen';
import type { Body } from '../../paint/unit';
import type { Look } from '../../species/look';
import type { Kit } from './pose';

export const A07: Look = { size: 32, pose: 'square', swap: false, eyes: 'dot', gear: 'none', serial: 'A-07' };

export const NO_KIT: Kit = { brain: false, hat: false, glasses: false };

/** Its look with what it has on: a unit wears one piece of gear, the hat over the glasses. */
export const lookWith = (kit: Kit): Look => ({ ...A07, gear: kit.hat ? 'hardhat' : kit.glasses ? 'glasses' : 'none' });

/** The scarf, its tail streaming away from where it looks, and the antenna a brain puts up. */
export function drawKit(pen: Pen, b: Body, kit: Kit, t: number, gaze: readonly [number, number]) {
  const { pal } = pen;
  const S = b.size;
  const band = b.top + b.h * 0.62;
  pen.rect(b.left - S * 0.05, band, b.w + S * 0.1, S * 0.15, b.z, pal.fg);
  const back = gaze[0] >= 0 ? -1 : 1;
  const root = back < 0 ? b.left + S * 0.12 : b.left + b.w - S * 0.12;
  const wave = Math.sin(t * 7) * S * 0.07;
  pen.shape(
    [
      [root, band + S * 0.04, b.z],
      [root + back * S * 0.46, band + S * 0.14 + wave, b.z],
      [root + back * S * 0.4, band + S * 0.3 + wave, b.z],
      [root - back * S * 0.04, band + S * 0.15, b.z],
    ],
    pal.fg,
  );
  if (!kit.brain) return;
  const top = b.top - (kit.hat ? S * 0.27 : 0);
  pen.line([b.x, top, b.z], [b.x, top - S * 0.38, b.z], pal.fg, Math.max(1, S * 0.06 * pen.scale(b.z)));
  pen.faded(0.22 + 0.14 * Math.sin(t * 3), () => pen.circle(b.x, top - S * 0.46, b.z, S * 0.24, pal.accent));
  pen.rect(b.x - S * 0.08, top - S * 0.54, S * 0.16, S * 0.16, b.z, pal.accent);
}

/** How far above its block the tallest thing it has on reaches, for its serial and callouts. */
export const headroom = (kit: Kit) => A07.size * (kit.brain ? 0.62 : kit.hat ? 0.32 : 0.06) + (kit.brain && kit.hat ? A07.size * 0.27 : 0);
