// Mom's house, far off on the horizon in the left margin as the train comes
// out into the light: a small house with its window lit, named on a callout,
// and once her answer is in, a heart rising from it.

import { span } from '../../species/motion';
import type { Room } from '../room';

const Z = 2600;
const HOUSE = { w: 170, h: 110, roof: 80 };

export type HomeMood = {
  /** Her house named on a callout, 0 to 1. */
  mom: number;
  /** The heart rising, 0 to 1 over its rise (0 when there is none). */
  heart: number;
};

export function drawHome(room: Room, mood: HomeMood) {
  if (room.side > 0) return;
  const { pen } = room;
  const { pal } = pen;
  const was = pen.haze;
  pen.haze = false;
  const floor = room.y;
  // The horizon, across the margin.
  pen.line([room.x(-200, Z), floor, Z], [room.x(room.margin + 200, Z), floor, Z], pal.line2);
  const x = room.x(room.margin * 0.72, Z) - HOUSE.w / 2;
  const top = floor - HOUSE.h;
  pen.rect(x, top, HOUSE.w, HOUSE.h, Z, pal.panel2, pal.ink);
  pen.shape(
    [
      [x - 16, top, Z],
      [x + HOUSE.w / 2, top - HOUSE.roof, Z],
      [x + HOUSE.w + 16, top, Z],
    ],
    pal.panel,
    pal.ink,
  );
  pen.rect(x + HOUSE.w * 0.62, floor - 62, 34, 62, Z, pal.panel, pal.ink);
  // Her window, lit.
  const wx = x + HOUSE.w * 0.18;
  const wy = top + 26;
  pen.glow(wx + 21, wy + 18, Z, 120, pal.accent, 0.5);
  pen.rect(wx, wy, 42, 36, Z, pal.accent, pal.ink);
  if (mood.mom) pen.faded(mood.mom, () => pen.tag('MOM', wx + 21, top - HOUSE.roof - 6, Z, pal.red));
  if (mood.heart) {
    const k = mood.heart;
    pen.faded(Math.min(1, k * 3) * (1 - span(k, 0.85, 1)), () =>
      pen.text('♥', wx + 21, top - HOUSE.roof - 70 - k * 420, Z, { px: 80 + k * 50, color: pal.red, align: 'center', serif: true }),
    );
  }
  pen.haze = was;
}
