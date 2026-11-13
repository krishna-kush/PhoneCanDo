// CH. 05, beside the gate: the key. Little stands at an open gate with the
// phone behind it, everything it can now do, Mom's note still unanswered
// beside it, and thinks. Then it pulls the
// bars down itself, and the only key rises out of the lock and floats out of
// the world toward you, growing as it comes, until it is yours.

import { arch, easeIn, easeInOut, span } from '../../species/motion';
import type { Story } from '../../world/frame';
import { at, play, walk, type Spot, type Step } from '../a07/pose';
import type { Pen } from '../../paint/pen';
import { drawScreen } from '../props';
import { standApp } from '../characters/app';
import type { Room } from '../room';

const GATE = { w: 84, h: 66, z: 236 };
const PHONE = { w: 28, h: 48, z: 300 };
const BARS = 7;

const AT_GATE = 1.4;
const THOUGHT = 2.8;
const LOCKED = 4.2;
const GIVEN = 6.6;

const spots = (room: Room) => {
  const o = room.fit(GATE.w + 50);
  return { o, front: { out: o + GATE.w + 22, z: 204 } as Spot };
};

function steps(room: Room): Step[] {
  const { front } = spots(room);
  const gate = [-room.side * 0.8, -0.5] as const;
  return [
    [0, AT_GATE, (k) => walk(room.hatch, front, k)],
    // It looks at Mom's note, then at the gate, and thinks.
    [AT_GATE, THOUGHT, (k) => at(front, { gaze: k < 0.45 ? [room.side * 0.8, -0.2] : gate, eyes: k > 0.6 ? 'sleepy' : 'dot' })],
    // It pulls the bars down: a lean in, a tug.
    [THOUGHT, LOCKED, (k) => at(front, { gaze: gate, sy: 1 - 0.08 * arch(span(k, 0.2, 0.7)), sx: 1 + 0.06 * arch(span(k, 0.2, 0.7)) })],
    // And watches the key go to you.
    [LOCKED, GIVEN, (k) => at(front, { gaze: k < 0.5 ? [0, -0.8] : [0, 0.1], eyes: k > 0.7 ? 'happy' : 'wide' })],
  ];
}

export const story: Story = {
  rests: [
    [0.15, THOUGHT],
    [0.45, GIVEN],
  ],
  leave: 0.86,
  pose: (sec, room) => play(steps(room), sec),
  narrate: [0, THOUGHT],
  // Once it has locked itself, a line runs from behind the lock on down to the tunnel (story/gifts/).
  gives: { gift: 'key', at: LOCKED, from: (room) => ({ out: spots(room).o + GATE.w / 2, z: GATE.z + 16 }) },
};

export function draw(room: Room) {
  if (room.side < 0) return;
  const { pen, sec } = room;
  const { pal } = pen;
  const { o } = spots(room);

  // The phone behind the gate: everything it could do, lit while it is open.
  const phone = room.box(o + (GATE.w - PHONE.w) / 2, 0, PHONE.z, PHONE.w, PHONE.h, 6, { front: pal.panel2, top: pal.panel, side: pal.panel2, stroke: pal.ink });
  const down = easeIn(span(sec, THOUGHT + 0.3, LOCKED - 0.3));
  drawScreen(pen, phone.x + 3, phone.y + 4, PHONE.z - 0.5, PHONE.w - 6, PHONE.h - 8, 5, -1, 0.35 * (1 - down));

  // The gate: a frame, and bars that come down when it pulls them.
  const frame = room.box(o, 0, GATE.z, GATE.w, GATE.h, 10, { top: pal.panel2, side: pal.panel2, stroke: pal.ink });
  const reach = GATE.h * (0.1 + 0.9 * down);
  for (let k = 1; k <= BARS; k++) pen.rect(frame.x + (k * GATE.w) / (BARS + 1) - 1.5, frame.y, 3, reach, GATE.z, pal.line2);
  pen.rect(frame.x, frame.y, GATE.w, 5, GATE.z - 1, pal.panel2, pal.ink);
  const cx = frame.x + GATE.w / 2;
  const lockY = frame.y + GATE.h * 0.45;
  if (down >= 1) {
    pen.arc(cx, lockY, GATE.z - 2, 5, Math.PI, Math.PI * 2, undefined, pal.fg, 2);
    pen.rect(cx - 7, lockY, 14, 11, GATE.z - 2, pal.red);
    pen.faded(span(sec, LOCKED - 0.3, LOCKED), () => pen.stamp('LOCKED', cx, frame.y - 14, GATE.z, pal.red, -0.07, 9));
  }

  // Messages, awake beside the gate with Mom's note still unanswered: it
  // could answer it now; it doesn't.
  standApp(room, 'messages', o + GATE.w + 70, 262, 22, { awake: 1, unread: true, gaze: -room.side });

  room.a07();

  // The key: up out of the lock, then out of the world toward you.
  const rise = span(sec, LOCKED - 0.1, LOCKED + 0.8);
  const go = span(sec, LOCKED + 0.8, GIVEN);
  if (rise <= 0 || go >= 1) return;
  const toward = easeInOut(go);
  const z = GATE.z - 4 - toward * (GATE.z + 500);
  const x = cx + toward * room.side * 60;
  const y = lockY - 14 - easeInOut(rise) * 24 - toward * 80;
  pen.faded(1 - span(go, 0.75, 1), () => drawKey(pen, x, y, z, 1 + toward * 0.4, rise * 0.4 + toward * 3));
}

/** A key, its ring at (x, y), [size] times its usual, turned [turn] radians. */
function drawKey(pen: Pen, x: number, y: number, z: number, size: number, turn: number) {
  const { pal } = pen;
  const r = 6 * size;
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const p = (u: number, v: number) => [x + u * c - v * s, y + u * s + v * c, z] as const;
  pen.faded(0.25, () => pen.circle(x, y, z, r * 2.4, pal.accent));
  pen.circle(x, y, z, r, undefined, pal.accent, Math.max(2, r * 0.4 * pen.scale(z)));
  pen.line(p(r, 0), p(r * 3.6, 0), pal.accent, Math.max(2, r * 0.4 * pen.scale(z)));
  pen.line(p(r * 2.8, 0), p(r * 2.8, r * 0.9), pal.accent, Math.max(2, r * 0.3 * pen.scale(z)));
  pen.line(p(r * 3.4, 0), p(r * 3.4, r * 0.7), pal.accent, Math.max(2, r * 0.3 * pen.scale(z)));
}
