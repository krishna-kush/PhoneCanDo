// A-07 into whichever room it is in now. While it drops through a hatch it
// is in two rooms at once: each draws its share, cut off at the slab between
// them, and the painter's order of the floors (world/render.ts) hides what
// the slab would.

import type { Body } from '../../paint/unit';
import { SLAB, floorY } from '../../world/building';
import type { Frame } from '../../world/frame';
import type { Room } from '../room';
import { A07, drawKit, headroom, lookWith } from './look';

export function drawA07(room: Room, f: Frame, i: number): Body | null {
  const a = f.actor;
  if (!a || room.side < 0) return null;
  const S = A07.size;
  const feet = floorY(a.i) - a.pose.up - (a.pose.lift ?? 0);
  const ceiling = i > 0 ? floorY(i - 1) + SLAB : -Infinity;
  if (feet <= ceiling || feet - S * 2.8 >= room.y) return null;
  const { pen } = room;
  const ctx = pen.ctx;
  const z = a.pose.z;
  const deckY = pen.at(0, room.y, z).y;
  const ceilingY = i > 0 ? pen.at(0, ceiling, z).y : -1e5;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, ceilingY, f.view.w, deckY - ceilingY);
  ctx.clip();
  const gaze = a.pose.gaze;
  const body = room.unit('a07', lookWith(a.kit), {
    out: a.pose.out,
    z,
    up: room.y - (floorY(a.i) - a.pose.up),
    lift: a.pose.lift,
    sx: a.pose.sx,
    sy: a.pose.sy,
    pose: a.pose.shape,
    eyes: a.pose.eyes,
    gaze,
  });
  drawKit(pen, body, a.kit, room.t, gaze ?? [-1, 0]);
  const over = body.top - headroom(a.kit) - 4;
  pen.text(A07.serial, body.x, over, z, { px: 7, color: pen.pal.red, align: 'center', track: 0.12, weight: 600 });
  if (a.pose.say) f.pokes.lines.push({ text: a.pose.say, x: body.x, y: over - 9, z });
  ctx.restore();
  return body;
}
