// The apps' floor's dock: a strip let into the deck with a square for each
// app, dashed while it is empty, solid once an awake app sits in it, its
// name on the deck behind; and a stamp once every square holds one.

import { playWords } from '../../../../../data/backdrop';
import type { P3 } from '../../../paint/pen';
import type { Room } from '../../../story/room';
import { span as within } from '../../../species/motion';
import type { Playground } from '../../playground';
import { SIZE, Z, floorOf } from '../../toys';
import { SLOT, slots, type Dock } from '../dock';

export function drawDock(room: Room, play: Playground, i: number, fx: Dock) {
  const { pen } = room;
  const { pal } = pen;
  const deck = room.y;
  if (pen.cam.y >= deck) return;
  const at = slots(fx, play.where.span);
  const x = (d: number) => room.x(d * pen.scale(Z), Z);
  const square = (cx: number, r: number, depth: number): P3[] => [
    [cx - r, deck, Z - depth],
    [cx + r, deck, Z - depth],
    [cx + r, deck, Z + depth],
    [cx - r, deck, Z + depth],
  ];
  const first = x(at[0]);
  const last = x(at[at.length - 1]);
  const mid = (first + last) / 2;
  const strip = (Math.abs(last - first) + SLOT) / 2;
  pen.shape(square(mid, strip, SIZE * 0.7), pal.panel2, pal.line2);
  at.forEach((d, k) => {
    const cx = x(d);
    const full = play.toys.some((o) => o.awake && o.dock === k && floorOf(o.y) === i);
    const sq = square(cx, SIZE / 2, SIZE / 2);
    if (full) pen.shape(sq, pal.artBg, pal.ink);
    else pen.poly([...sq, sq[0]], pal.ink, 1, [3, 3]);
  });
  pen.text(playWords.dock.toUpperCase(), mid, deck, Z + SIZE * 0.7 + 10, { px: 7, min: 6, color: pal.muted, align: 'center', track: 0.14 });
  if (fx.fullAt > 0) {
    const k = within(play.now - fx.fullAt, 0, 0.3);
    pen.faded(k, () => pen.stamp(playWords.docked.toUpperCase(), mid, deck - SIZE * 2.4, Z, pal.red, -0.08, 9));
  }
}
