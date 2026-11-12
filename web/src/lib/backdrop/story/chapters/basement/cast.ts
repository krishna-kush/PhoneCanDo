// The basement's cast, in the left margin: packages come out from under the
// sheet on a belt and drop onto a pile at its end, where a cousin in a hard
// hat catches each one; at five the pile is installed and gone.

import { drawCrate } from '../../props';
import { cousin } from '../../../species/look';
import { easeIn, jump, mix, span } from '../../../species/motion';
import type { Room } from '../../room';

const LOADER = cousin('basement:loader', { size: 24, gear: 'hardhat', swap: true, pose: 'square' });
const BELT = { h: 12, d: 28, z: 170 };
const CRATE = 16;
const COUNT = 5;
const EVERY = 1.3;
const RIDE = 2.6;
const FALL = 0.35;
const CYCLE = (COUNT - 1) * EVERY + RIDE + FALL + 1.4;

export function cast(room: Room) {
  const { pen, t } = room;
  const { pal } = pen;
  const o = room.fit(140);
  const z = BELT.z;
  // The belt runs from under the sheet out to o + 80.
  const from = room.x(-40, z);
  const to = room.x(o + 80, z);
  const left = Math.min(from, to);
  const length = Math.abs(to - from);
  const top = room.y - BELT.h;
  pen.box(left, top, z, length, BELT.h, BELT.d, { front: pal.panel2, top: pal.panel, side: pal.panel2, stroke: pal.ink });
  // Rollers ticking by on the belt's top.
  for (let u = (t * 46) % 18; u < length; u += 18) {
    const x = from + room.side * u;
    pen.line([x, top, z], [x, top, z + BELT.d], pal.line2);
  }

  const c = t % CYCLE;
  const pileOut = o + 96;
  const pileX = room.x(pileOut, z) - CRATE / 2;
  const landings: number[] = [];
  for (let j = 0; j < COUNT; j++) {
    const s = c - j * EVERY;
    if (s < 0) continue;
    const ride = s / RIDE;
    let x: number;
    let y: number;
    if (ride < 1) {
      x = from + room.side * ride * length - CRATE / 2;
      y = top - CRATE;
    } else {
      const k = span(s, RIDE, RIDE + FALL);
      x = mix(to - CRATE / 2, pileX, k);
      y = mix(top - CRATE, room.y - CRATE * (j + 1), easeIn(k));
      if (k >= 1) landings.push(j * EVERY + RIDE + FALL);
    }
    const gone = span(c, CYCLE - 1.1, CYCLE - 0.5);
    pen.faded(1 - gone, () => drawCrate(pen, x, y, z - 4, CRATE, CRATE, 'pkg'));
  }
  // The pile is installed: a ring where it stood.
  const poof = span(c, CYCLE - 1.1, CYCLE - 0.3);
  if (poof > 0 && poof < 1) pen.faded(1 - poof, () => pen.ring(pileX + CRATE / 2, room.y, z + CRATE / 2, 14 + poof * 50, pal.accent, 1.5));

  const caught = landings.length ? c - Math.max(...landings) : 9;
  const j = jump(span(caught, 0, 0.45), 16);
  room.unit('basement:loader', LOADER, {
    out: pileOut + 28,
    z: z - 10,
    lift: j.lift,
    sx: j.sx,
    sy: j.sy,
    eyes: caught < 0.45 ? 'happy' : 'dot',
    gaze: room.look(pileOut + 28, 0, z - 10, LOADER.size, pileX, room.y - CRATE * 2, z),
  });
}
