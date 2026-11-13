// The light an awake toy gives: a little always, which only shows through
// the dark (world/render.ts), more as the world goes dark, with a warm glow
// round it; and the flashlight's beam, toward your pointer when it is in
// this margin, otherwise out and a little down, faint in the daylight and
// bright in the tunnel. The more you woke and brought down, the more of
// the dark they light.

import type { Room } from '../../story/room';
import type { Frame } from '../../world/frame';
import { TRAITS } from '../kinds';
import { Z, type Toy } from '../toys';

/** How far the beam reaches, world units, and half its spread, radians. */
const REACH = 160;
const SPREAD = 0.34;

/** The light round an awake toy whose block is centred on (cx, cy). */
export function shine(room: Room, f: Frame, toy: Toy, cx: number, cy: number) {
  const { pen } = room;
  const dark = f.play.dark;
  room.light(cx, cy, Z, (toy.spark ? 80 : 50) + 30 * dark);
  if (dark > 0.05) pen.glow(cx, cy, Z, 44, pen.pal.accent, 0.3 * dark);
  if (TRAITS[toy.kind].trick === 'shine') beam(room, f, cx, cy, dark);
}

function beam(room: Room, f: Frame, cx: number, cy: number, dark: number) {
  const { pen } = room;
  const from = pen.at(cx, cy, Z);
  const p = f.pointer;
  const a = p && p.x < f.view.left ? Math.atan2(p.y - from.y, p.x - from.x) : Math.PI - 0.3;
  const along = (k: number, da: number) => [cx + Math.cos(a + da) * REACH * k, cy + Math.sin(a + da) * REACH * k, Z] as const;
  pen.faded(0.08 + 0.32 * dark, () => pen.shape([[cx, cy, Z], along(1, -SPREAD), along(1, SPREAD)], pen.pal.accent));
  for (const k of [0.3, 0.6, 0.92]) {
    const [x, y] = along(k, 0);
    room.light(x, y, Z, 20 + 50 * k);
  }
}
