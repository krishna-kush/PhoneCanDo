// The glass's cast, in the left margin: two cousins hop over the app tiles
// on a loop, each landing a tap that rings out across the glass.

import { cousin } from '../../../species/look';
import { easeInOut, jump, mix } from '../../../species/motion';
import type { Room } from '../../room';

const TAPPERS = [
  cousin('glass:tapper1', { size: 26, gear: 'headset', pose: 'square' }),
  cousin('glass:tapper2', { size: 20, gear: 'cap', pose: 'square', swap: true }),
];
const COLS = 3;
const TILE = 30;
const STEP = 42;
const ROW_Z = [80, 80 + STEP];
const ROUTES = [
  [0, 4, 2, 3, 1, 5],
  [5, 1, 3, 0, 4, 2],
];
const HOP = 0.8;

export function cast(room: Room) {
  const { pen, t } = room;
  const { pal } = pen;
  const o = room.fit(COLS * STEP);
  const spot = (k: number) => ({ out: o + (k % COLS) * STEP + TILE / 2, z: ROW_Z[Math.floor(k / COLS)] + TILE / 2 });
  const hops = TAPPERS.map((look, u) => {
    const clock = t / HOP + u * 0.5;
    const n = Math.floor(clock);
    const route = ROUTES[u];
    return { look, u, q: clock - n, from: route[n % route.length], to: route[(n + 1) % route.length] };
  });
  for (let k = COLS * 2 - 1; k >= 0; k--) {
    const z = ROW_Z[Math.floor(k / COLS)];
    const top = room.box(o + (k % COLS) * STEP, 0, z, TILE, 4, TILE, { front: pal.panel2, top: pal.panel, side: pal.panel2, stroke: pal.ink });
    const glow = Math.max(0, ...hops.filter((h) => h.from === k).map((h) => 1 - h.q * 1.4));
    if (glow > 0) {
      pen.faded(glow * 0.85, () => pen.box(top.x, top.y, z, TILE, 4, TILE, { top: pal.red }));
      pen.faded(glow, () => pen.ring(top.x + TILE / 2, top.y, z + TILE / 2, 10 + (1 - glow) * 46, pal.red, 1.5));
    }
  }
  for (const h of hops.sort((a, b) => spot(b.to).z - spot(a.to).z)) {
    const a = spot(h.from);
    const b = spot(h.to);
    const k = easeInOut(h.q);
    const j = jump(h.q, 30);
    const out = mix(a.out, b.out, k);
    const z = mix(a.z, b.z, k);
    room.unit(`glass:tapper${h.u + 1}`, h.look, {
      out,
      z,
      up: 4,
      lift: j.lift,
      sx: j.sx,
      sy: j.sy,
      gaze: room.look(out, 4, z, h.look.size, room.x(b.out, b.z), room.y, b.z),
    });
  }
}
