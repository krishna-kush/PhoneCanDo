// Your hand in the playground: the point under the pointer at the apps'
// depth, the app you picked up kept under it (where you took hold of it), and
// how fast your hand was going when you let go, which is how hard it flies.
// A click that never moved puts it back where it was; let go with its feet
// in a floor's slab, it stands on that floor, not the one under it.

import { edgeX, unproject, type Camera } from '../camera';
import { SLAB, floorY } from '../world/building';
import type { View } from '../world/frame';
import { SIZE, Z, floorOf, type Toy } from './toys';

/** A held app's hand: the pointer on screen, where on the app it was taken, and the hand's recent path. */
export type Grip = {
  toy: Toy;
  sx: number;
  sy: number;
  /** From the pointer to the app's feet, world units. */
  dd: number;
  dy: number;
  /** Where the app and the pointer were when it was taken. */
  from: { d: number; y: number; sx: number; sy: number };
  trail: { t: number; d: number; y: number }[];
};

/** How far back the throw's speed is measured, seconds. */
const TRAIL = 0.08;
const HARDEST = 2400;
/** A pointer that moved less than this, CSS px, only clicked. */
const CLICK = 4;

/** The world point at the apps' depth under a point on screen in the left margin: out from the sheet, and y. */
export function under(cam: Camera, view: View, sx: number, sy: number) {
  const p = unproject(cam, sx, sy, Z);
  return { d: edgeX(cam, view.left, -1, 0, Z) - p.x, y: p.y };
}

/** The app drawn last (so in front) whose box is under a screen point. */
export function pick(toys: Toy[], sx: number, sy: number): Toy | null {
  for (let k = toys.length - 1; k >= 0; k--) {
    const b = toys[k].box;
    if (b && sx >= b.x0 && sx <= b.x1 && sy >= b.y0 && sy <= b.y1) return toys[k];
  }
  return null;
}

export function takeHold(toy: Toy, cam: Camera, view: View, sx: number, sy: number, t: number): Grip {
  const p = under(cam, view, sx, sy);
  toy.held = true;
  toy.chute = -1;
  toy.up = false;
  toy.hole = NaN;
  toy.dock = -1;
  toy.dig = -1;
  toy.climbing = false;
  toy.vx = toy.vy = 0;
  return {
    toy,
    sx,
    sy,
    dd: toy.d - p.d,
    dy: toy.y - p.y,
    from: { d: toy.d, y: toy.y, sx, sy },
    trail: [{ t, d: toy.d, y: toy.y }],
  };
}

/** Keeps the held app under the pointer as the pointer and the camera move; its speed is the hand's. */
export function follow(g: Grip, cam: Camera, view: View, t: number) {
  const p = under(cam, view, g.sx, g.sy);
  const toy = g.toy;
  toy.d = p.d + g.dd;
  toy.y = p.y + g.dy;
  g.trail.push({ t, d: toy.d, y: toy.y });
  while (g.trail.length > 2 && t - g.trail[1].t > TRAIL) g.trail.shift();
  const first = g.trail[0];
  const span = t - first.t;
  if (span > 0.005) {
    toy.vx = (toy.d - first.d) / span;
    toy.vy = (toy.y - first.y) / span;
  }
}

/** The floor an app let go at world y comes down on: with its feet in a slab, the floor that slab carries, not the one under it. */
export function landsOn(y: number): number {
  const i = floorOf(y);
  return i > 0 && y < floorY(i - 1) + SLAB + SIZE / 2 ? i - 1 : i;
}

/** Lets go: it flies off at the hand's speed, no faster than a throw can be. */
export function letGo(g: Grip) {
  const toy = g.toy;
  toy.held = false;
  // Only a click: the camera eased on under it, but the app never moved.
  if (Math.hypot(g.sx - g.from.sx, g.sy - g.from.sy) < CLICK) {
    toy.d = g.from.d;
    toy.y = g.from.y;
    toy.vx = toy.vy = 0;
    return;
  }
  toy.y = Math.min(toy.y, floorY(landsOn(toy.y)));
  const speed = Math.hypot(toy.vx, toy.vy);
  if (speed > HARDEST) {
    toy.vx *= HARDEST / speed;
    toy.vy *= HARDEST / speed;
  }
}
