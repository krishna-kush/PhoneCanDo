// One frame of the building, drawn into the two margins only (the sheet
// covers the rest): the board and the sky, the specks, then the floors in
// painter's order. A floor is its slab and the room standing on it; seen
// from below, a slab hides the room on it, and seen from above it hides the
// rooms under it, so the floors are drawn from the furthest away from the
// camera's own room to the nearest, above and below, and that room last.
// A-07 is placed first, as its hatches and captions follow it. Callouts go
// over everything.

import { scaleAt } from '../camera';
import { placeA07 } from '../story/a07/actor';
import { drawHatch } from '../story/a07/hatch';
import { drawCaption } from '../story/caption';
import { makeRoom } from '../story/room';
import { DEEP, PITCH, SLAB } from './building';
import { drawCrowd, makeCrowd, stepCrowd } from './crowd';
import type { Frame } from './frame';
import { drawMotes } from './motes';
import { drawSlab } from './slab';
import { drawWall } from './wall';

export function render(f: Frame) {
  const { pen, view } = f;
  const ctx = pen.ctx;
  ctx.clearRect(0, 0, view.w, view.h);
  f.pokes.clear();
  if (!f.floors.length) return;
  f.actor = placeA07(f);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, view.left, view.h);
  ctx.rect(view.right, 0, view.w - view.right, view.h);
  ctx.clip();
  drawWall(f);
  drawMotes(f);
  for (const [kind, i] of order(f)) {
    if (kind === 'slab') {
      drawSlab(f, i);
      drawHatch(f, i);
    } else drawRoom(f, i);
  }
  for (const line of f.pokes.lines) pen.tag(line.text, line.x, line.y, line.z);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function order(f: Frame): ['slab' | 'room', number][] {
  const { cam, view } = f;
  const n = f.floors.length;
  const s = scaleAt(cam, DEEP);
  // Floors whose room or slab reaches into the view at the back.
  const top = cam.y - cam.cy / s;
  const bottom = cam.y + (view.h - cam.cy) / s;
  const clampI = (v: number) => Math.min(n - 1, Math.max(0, v));
  const lo = clampI(Math.floor(top / PITCH) - 1);
  const hi = clampI(Math.floor((bottom - SLAB) / PITCH));
  const own = clampI(Math.floor(cam.y / PITCH));
  const out: ['slab' | 'room', number][] = [];
  for (let i = lo; i < own; i++) out.push(['room', i], ['slab', i]);
  for (let i = hi; i > own; i--) out.push(['slab', i], ['room', i]);
  out.push(['slab', own], ['room', own]);
  return out;
}

function drawRoom(f: Frame, i: number) {
  const floor = f.floors[i];
  for (const side of [-1, 1] as const) {
    const room = makeRoom(f, i, side);
    const crowd = floor.scene.crowd;
    if (crowd?.count) {
      const key = `${floor.key}:${side}`;
      let walkers = f.crowds.get(key);
      if (!walkers) f.crowds.set(key, (walkers = makeCrowd(floor.key, side, crowd.count, crowd.gear)));
      if (!f.still) stepCrowd(walkers, f.dt, room.margin);
      drawCrowd(walkers, room);
    }
    floor.scene.draw(room);
    if (side > 0) drawCaption(room, i, floor.words.caption, room.a07());
  }
}
