// A Drifter: one of the cloud folk, who think for everyone from very far
// away. A cloud of square puffs that breathe, two slow eyes that look about,
// a pale shadow on the floor far below, and, while it thinks, three dots
// that take their time.

import { voices } from '../../../../data/backdrop';
import { drawCloud } from '../../paint/cloud';
import type { Pen, P3 } from '../../paint/pen';
import type { Room } from '../room';

export type DrifterMood = {
  /** Where it looks, -1 to 1 across, and down (0 to 1). */
  gaze: number;
  down?: number;
  /** Thinking, 0 to 1: the dots come up. */
  thinking?: number;
  /** The floor under it, for its shadow. */
  floor?: number;
};

/** A Drifter [w] wide, its middle at (x, y); returns its screen box and the point over it. */
export function drawDrifter(pen: Pen, x: number, y: number, z: number, w: number, t: number, mood: DrifterMood, seed = 0) {
  const { pal } = pen;
  const bob = Math.sin(t * 0.6 + seed) * w * 0.04;
  const sway = Math.sin(t * 0.23 + seed * 2) * w * 0.05;
  const cx = x + sway;
  const cy = y + bob;
  if (mood.floor !== undefined) {
    pen.faded(0.25, () => pen.ring(cx, mood.floor!, z, w * 0.32, pal.line2, 1));
  }
  const breathe = 1 + Math.sin(t * 0.9 + seed) * 0.025;
  drawCloud(pen, cx, cy, z, w * breathe);
  // Eyes: two dark squares that wander, blink, and look where they're told.
  const blink = (t * 0.7 + seed) % 5 < 0.15;
  const wander = Math.sin(t * 0.4 + seed * 5) * 0.3;
  const gx = Math.max(-1, Math.min(1, mood.gaze + wander));
  const ew = w * 0.06;
  const eh = blink ? w * 0.01 : w * 0.075;
  const ex = cx - w * 0.12 + gx * w * 0.035;
  const ey = cy - w * 0.03 + (mood.down ?? 0) * w * 0.025;
  pen.rect(ex, ey, ew, eh, z, pal.ink);
  pen.rect(ex + w * 0.16, ey, ew, eh, z, pal.ink);
  // Thinking: three dots over it, one at a time, slowly.
  const thinking = mood.thinking ?? 0;
  if (thinking > 0) {
    const n = Math.floor(t * 1.4 + seed) % 4;
    for (let k = 0; k < 3; k++) {
      pen.faded(thinking * (k < n ? 1 : 0.2), () => pen.rect(cx - w * 0.1 + k * w * 0.1, cy - w * 0.5, w * 0.05, w * 0.05, z, pal.ink));
    }
  }
  const a = pen.at(cx - w * 0.5, cy - w * 0.42, z);
  const b = pen.at(cx + w * 0.5, cy + w * 0.22, z);
  const over: P3 = [cx, cy - w * 0.45, z];
  return { box: { x0: a.x, y0: a.y, x1: b.x, y1: b.y }, over };
}

/** A Drifter over a room, answering a click (late, and thinking about it). */
export function floatDrifter(room: Room, name: string, x: number, up: number, z: number, w: number, mood: DrifterMood, seed = 0) {
  const heard = room.heard(name);
  const thinking = heard.talking ? 1 : mood.thinking ?? 0;
  const drawn = drawDrifter(room.pen, x, room.y - up, z, w, room.t, { ...mood, thinking, floor: room.y }, seed);
  room.clickable(name, drawn.box, voices.drifter, drawn.over);
}
