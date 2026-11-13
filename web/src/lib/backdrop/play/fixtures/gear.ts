// What a toy has picked up from the fixtures, drawn on it: an app's hard hat
// from the pit, as the Diggers wear (paint/unit.ts; a cousin keeps its own
// hat), and over it a spark of its own, bobbing; the moment it caught the
// spark, a ring going out and a few thinking dots.

import { arch, phase } from '../../species/motion';
import type { Room } from '../../story/room';
import { Z, type Toy } from '../toys';
import { drawStar } from './paint/spark';
import { LIT } from './kinds';

/** The app's front block as drawApp returned it. */
type Block = { left: number; top: number; w: number; h: number };

/** Its gear over the block it was drawn as (a cousin's measured from its hat's top), [size] the size it was drawn at. */
export function drawGear(room: Room, toy: Toy, b: Block, size: number, n: number) {
  const { pen, t } = room;
  const { pal } = pen;
  const cx = b.left + b.w / 2;
  let top = b.top;
  if (toy.hat && !toy.look) {
    pen.rect(b.left + b.w * 0.1, top - size * 0.27, b.w * 0.8, size * 0.28, Z, pal.accent, pal.ink);
    pen.rect(b.left - size * 0.09, top - size * 0.04, b.w + size * 0.18, size * 0.08, Z, pal.accent, pal.ink);
    top -= size * 0.27;
  }
  if (toy.spark) drawStar(room, cx, top - 8 + Math.sin(t * 2.2 + n) * 1.5, 4);
  if (toy.lit <= 0) return;
  const k = 1 - toy.lit / LIT;
  pen.faded(1 - k, () => pen.ring(cx, b.top + b.h / 2, Z, 10 + k * 34, pal.accent, 1.5));
  // Thinking it over, a mind of its own now.
  for (let d = 0; d < 3; d++) {
    const q = phase(t * 1.6, 1, d / 3);
    pen.faded(arch(k * 1.2) * (0.5 + 0.5 * arch(q)), () => pen.rect(cx + 8 + d * 5, top - 18 - arch(q) * 2, 2.5, 2.5, Z, pal.muted));
  }
}
