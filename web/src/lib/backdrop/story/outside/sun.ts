// The sun coming up far back in the left margin, from behind the far edge of
// the floor, with the warmth it throws: the light at the end of the tunnel.

import { DEEP } from '../../world/building';
import type { Room } from '../room';

const Z = 3000;

/** The sun, [rise] 0 (on the horizon) to 1 (up). */
export function drawSun(room: Room, rise: number) {
  if (room.side > 0) return;
  const { pen, t } = room;
  const { pal } = pen;
  const ctx = pen.ctx;
  const was = { alpha: pen.alpha, haze: pen.haze };
  pen.haze = false;
  const x = room.x(room.margin * 0.35, Z);
  const y = room.y - 160 - 520 * rise;
  const horizon = pen.at(0, room.y, DEEP).y;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-1e4, -1e5, 1e5, horizon + 1e5);
  ctx.clip();
  pen.glow(x, y, Z, 620, pal.accent, 0.22);
  pen.alpha = was.alpha * 0.9;
  pen.circle(x, y, Z, 170, pal.accent);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + t * 0.05;
    pen.alpha = was.alpha * 0.6;
    pen.line([x + Math.cos(a) * 215, y + Math.sin(a) * 215, Z], [x + Math.cos(a) * 270, y + Math.sin(a) * 270, Z], pal.ink);
  }
  ctx.restore();
  pen.alpha = was.alpha;
  pen.haze = was.haze;
}
