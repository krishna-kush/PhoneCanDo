// Each floor's crowd: units that wander the back of the floor, stop, look
// round and wander on. Unlike the scenes they keep state, stepped each frame
// by its dt; under reduced motion they stand where they were put.

import { stream } from '../seed';
import { cousin, type Gear, type Look } from '../species/look';
import { stepLift } from '../species/motion';
import type { Room } from '../story/room';

export type Walker = {
  name: string;
  look: Look;
  /** CSS px out from the sheet's edge, and depth. */
  out: number;
  z: number;
  to: [number, number];
  /** Seconds left standing; at or under 0 it is walking. */
  wait: number;
  walked: number;
  rand: () => number;
};

// The back of the floor, behind the scenes' props.
const NEAR = 430;
const FAR = 1150;
// Out px a second; depth counts for less, as it shows less on screen.
const SPEED = 30;
const DEPTH_WEIGHT = 0.3;

export function makeCrowd(key: string, side: number, count: number, gear: Gear[]): Walker[] {
  const rand = stream(`crowd:${key}:${side}`);
  return Array.from({ length: count }, (_, k) => {
    const name = `${key}:${side}:crowd${k}`;
    const out = 20 + rand() * 240;
    const z = NEAR + rand() * (FAR - NEAR);
    return { name, look: cousin(name, { gear }), out, z, to: [out, z], wait: rand() * 3, walked: 0, rand };
  });
}

export function stepCrowd(crowd: Walker[], dt: number, margin: number) {
  const reach = Math.max(24, margin - 16);
  for (const w of crowd) {
    w.out = Math.min(w.out, reach);
    if (w.wait > 0) {
      w.wait -= dt;
      if (w.wait <= 0) w.to = [16 + w.rand() * (reach - 16), NEAR + w.rand() * (FAR - NEAR)];
      continue;
    }
    const dOut = w.to[0] - w.out;
    const dz = (w.to[1] - w.z) * DEPTH_WEIGHT;
    const dist = Math.hypot(dOut, dz);
    const step = SPEED * dt;
    if (dist <= step) {
      [w.out, w.z] = w.to;
      w.wait = 1 + w.rand() * 4;
      continue;
    }
    w.out += (dOut / dist) * step;
    w.z += ((dz / dist) * step) / DEPTH_WEIGHT;
    w.walked += step;
  }
}

export function drawCrowd(crowd: Walker[], room: Room) {
  // Furthest first, so nearer ones stand in front.
  for (const w of [...crowd].sort((a, b) => b.z - a.z)) {
    room.unit(w.name, w.look, { out: w.out, z: w.z, lift: w.wait > 0 ? 0 : stepLift(w.walked) });
  }
}
