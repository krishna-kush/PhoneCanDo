// Crew quarters' cast, in the left margin: three cousins pass a note round,
// each catching it with a hop; every third lap one calls all hands and a
// ring goes out across the floor while they all hop at once.

import { cousin } from '../../../species/look';
import { arch, jump, mix, span } from '../../../species/motion';
import { drawNote } from '../../props';
import type { Room } from '../../room';

const PASSERS = [
  cousin('quarters:a', { size: 26, gear: 'antenna', pose: 'square' }),
  cousin('quarters:b', { size: 22, gear: 'headset', swap: true, pose: 'square' }),
  cousin('quarters:c', { size: 24, gear: 'bow', pose: 'square' }),
];
const LEG = 1.1;
const LAP = LEG * PASSERS.length;
const CALL = 1.8;
const CYCLE = LAP * 3 + CALL;

export function cast(room: Room) {
  const { pen, t } = room;
  const { pal } = pen;
  const o = room.fit(140);
  const spots = [
    { out: o + 18, z: 100 },
    { out: o + 120, z: 170 },
    { out: o + 50, z: 300 },
  ];
  const c = t % CYCLE;
  const call = c >= LAP * 3 ? (c - LAP * 3) / CALL : -1;
  const leg = call < 0 ? Math.floor(c / LEG) : -1;
  const k = call < 0 ? (c % LEG) / LEG : 0;
  const from = leg % PASSERS.length;
  const to = (from + 1) % PASSERS.length;
  const head = (i: number) => [room.x(spots[i].out, spots[i].z), room.y - PASSERS[i].size * 1.5, spots[i].z] as const;

  if (call >= 0) {
    pen.faded(1 - call, () => pen.ring(room.x(spots[0].out, spots[0].z), room.y, spots[0].z, 20 + call * 220, pal.red, 1.5));
    pen.faded(arch(call), () => pen.stamp('ALL HANDS', head(0)[0], head(0)[1] - 30, spots[0].z, pal.red, -0.08, 8));
  }
  const order = spots.map((s, i) => ({ s, i })).sort((a, b) => b.s.z - a.s.z);
  for (const { s, i } of order) {
    // Each hops as the note lands with it, or all at once on a call.
    const caught = call >= 0 ? jump(span(call, 0.1 + i * 0.05, 0.5 + i * 0.05), 22) : i === from ? jump(span(k, 0, 0.3), 14) : null;
    const target = call >= 0 ? head(0) : head(to);
    room.unit(`quarters:${'abc'[i]}`, PASSERS[i], {
      out: s.out,
      z: s.z,
      lift: caught?.lift,
      sx: caught?.sx,
      sy: caught?.sy,
      eyes: caught && caught.lift > 0 ? 'happy' : 'dot',
      gaze: room.look(s.out, 0, s.z, PASSERS[i].size, target[0], target[1], target[2]),
    });
  }
  if (call < 0) {
    const a = head(from);
    const b = head(to);
    drawNote(pen, mix(a[0], b[0], k), mix(a[1], b[1], k) - arch(k) * 50, mix(a[2], b[2], k), 14, k * 6);
  }
}
