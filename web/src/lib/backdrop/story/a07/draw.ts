// Little into whichever room it is in now. While it drops through a hatch it
// is in two rooms at once: each draws its share, cut off at the slab between
// them, and the painter's order of the floors (world/render.ts) hides what
// the slab would. Speed lines while it falls, dust when it lands, a fidget
// while it waits; its Spark is a light that shows through the dark, and
// answers a click of its own.

import { voices } from '../../../../data/backdrop';
import type { Body } from '../../paint/unit';
import { jump, phase } from '../../species/motion';
import { SLAB, floorY } from '../../world/building';
import type { Frame } from '../../world/frame';
import type { Room } from '../room';
import { SPARK } from '../characters/spark';
import { A07, drawKit, headroom } from './look';

// While it waits for the scroll, every few seconds: a little hop, then a
// look out at you.
const FIDGET = 6.5;

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
  // Its share of this room: under the slab above, over the deck below, at
  // its depth or, where the slab's cut face stands in front, at the face.
  const deckY = Math.min(pen.at(0, room.y, z).y, pen.at(0, room.y, 0).y);
  const ceilingY = i > 0 ? Math.max(pen.at(0, ceiling, z).y, pen.at(0, ceiling, 0).y) : -1e5;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, ceilingY, f.view.w, deckY - ceilingY);
  ctx.clip();
  const { pal } = pen;
  const up = room.y - (floorY(a.i) - a.pose.up);
  // Waiting on the scroll, standing: now and then a hop, then a look at you.
  const idle = f.resting && !f.still && !a.pose.lift && a.pose.shape !== 'wider' && !a.pose.sx;
  const fidget = idle ? phase(room.t, FIDGET) : 1;
  const hop = idle ? jump(fidget / 0.09, 9) : null;
  const glance = idle && fidget > 0.12 && fidget < 0.32;
  const gaze = glance ? ([0, 0.1] as const) : a.pose.gaze;
  if (a.pose.falling) {
    // Speed lines, streaming up off it as it drops.
    const x = room.x(a.pose.out, z);
    for (let k = -1; k <= 1; k++) {
      const top = room.y - up - S * 1.4 - 30 - Math.abs(k) * 12;
      pen.faded(a.pose.falling * 0.8, () => pen.line([x + k * S * 0.35, top, z], [x + k * S * 0.35, top - 26 - a.pose.falling! * 40, z], pal.ink));
    }
  }
  const body = room.unit('a07', A07, {
    out: a.pose.out,
    z,
    up,
    lift: hop && hop.lift ? hop.lift : a.pose.lift,
    sx: hop && hop.lift ? hop.sx : a.pose.sx,
    sy: hop && hop.lift ? hop.sy : a.pose.sy,
    shape: a.pose.shape,
    eyes: a.pose.eyes,
    gaze,
    facing: glance ? undefined : a.pose.facing,
  });
  if (a.pose.landing !== undefined && a.pose.landing < 1) {
    const k = a.pose.landing;
    pen.faded(1 - k, () => pen.ring(body.x, room.y - up, z, S * 0.6 + k * S * 1.4, pal.line2, 1.5));
  }
  const spark = drawKit(pen, body, a.kit, room.t, gaze ?? [-1, 0]);
  if (spark) {
    room.light(spark.x, spark.y, spark.z, 70);
    const r = SPARK.size * 1.2;
    const lo = pen.at(spark.x - r, spark.y - r, spark.z);
    const hi = pen.at(spark.x + r, spark.y + r, spark.z);
    room.clickable('spark', { x0: lo.x, y0: lo.y, x1: hi.x, y1: hi.y }, voices.spark, [spark.x, spark.y - r, spark.z]);
  }
  const over = body.top - headroom(a.kit) - 4;
  pen.text(A07.serial, body.x, over, z, { px: 7, color: pen.pal.red, align: 'center', track: 0.12, weight: 600 });
  if (a.pose.say) f.pokes.lines.push({ text: a.pose.say, x: body.x, y: over - 9, z });
  ctx.restore();
  return body;
}
