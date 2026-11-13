// The Spark over the models' floor, in the page's line-work: a four-pointed
// star hanging over a ring on the deck, and a dashed spark down to each app
// that has just caught one of its own; and the small star an app carries
// after (fixtures/gear.ts).

import type { Room } from '../../../story/room';
import type { Playground } from '../../playground';
import { Z, floorOf } from '../../toys';
import { LIT } from '../kinds';

/** How high the Spark hangs over its ring. */
const HANG = 46;

/** A star's four points round (x, y), [r] out. */
function star(x: number, y: number, r: number) {
  const k = r * 0.28;
  return [
    [x, y - r, Z],
    [x + k, y - k, Z],
    [x + r, y, Z],
    [x + k, y + k, Z],
    [x, y + r, Z],
    [x - k, y + k, Z],
    [x - r, y, Z],
    [x - k, y - k, Z],
  ] as const;
}

/** A small star on a glow at (x, y): the Spark's, and the one an app carries. */
export function drawStar(room: Room, x: number, y: number, r: number) {
  const { pen } = room;
  const { pal } = pen;
  pen.glow(x, y, Z, r * 4, pal.accent, 0.35);
  pen.shape(star(x, y, r), pal.accent, pal.ink);
}

export function drawSparkLamp(room: Room, play: Playground, i: number, x: number) {
  const { pen, t } = room;
  const { pal } = pen;
  const deck = room.y;
  // Its ring on the deck, where an app catches a spark.
  const ring = [...Array(20)].map((_, k) => {
    const a = (k / 20) * Math.PI * 2;
    return [x + Math.cos(a) * 22, deck, Z + Math.sin(a) * 16] as const;
  });
  pen.faded(0.5 + 0.3 * Math.sin(t * 2.4), () => pen.shape(ring, undefined, pal.accent));
  const y = deck - HANG + Math.sin(t * 1.6) * 3;
  drawStar(room, x, y, 9 + 1.2 * Math.sin(t * 2.4));
  room.light(x, y, Z, 70);
  // A spark down to each app that has just caught one.
  for (const toy of play.toys) {
    if (toy.lit <= 0 || floorOf(toy.y) !== i || !toy.box) continue;
    const k = toy.lit / LIT;
    const to = room.x(toy.d * pen.scale(Z), Z);
    pen.faded(k, () => pen.line([x, y + 9, Z], [to, toy.y - 34, Z], pal.accent, 1.5, [3, 3]));
  }
}
