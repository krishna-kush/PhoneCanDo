// CH. 05, the vault, beside the gate. Phone control ships locked: A-07
// walks up to the bars and bonks into them. It tries the fingerprint pad
// itself and is refused (an agent can never arm itself). Then a cursor, you,
// comes in and presses the pad: ARMED, the bars go up, and A-07 goes
// through to the phone. Once it has gone, the gate locks again behind it.

import { arch, easeInOut, span } from '../../../species/motion';
import type { Story } from '../../../world/frame';
import { at, hop, play, walk, type Spot, type Step } from '../../a07/pose';
import { drawPrint, drawScreen } from '../../props';
import type { Room } from '../../room';
import { drawBars, drawCursor } from './gate';

const GATE = { w: 80, h: 64, z: 236 };
const PHONE = { w: 26, h: 46, z: 300 };
const PAD = { w: 24, h: 26, post: 30, z: 150 };

const AT_GATE = 1.3;
const BONKED = 2.0;
const AT_PAD = 3.1;
const PRESSED = 3.5;
const REFUSED = 4.5;
const CURSOR_IN = 5.7;
const CURSOR_DOWN = 6.1;
const SCANNED = 6.7;
const OPENED = 7.3;
const CHEERED = 7.7;
const THROUGH = 9.1;
const TAPPED = 9.8;
// A-07 leaves after its last rest; by now it is at the hatch.
const RELOCK = TAPPED + 1.6;

const layout = (room: Room) => {
  const o = room.fit(GATE.w + 50);
  return {
    o,
    gate: { out: o + 40 + GATE.w / 2, z: 200 } as Spot,
    pad: { out: o + 44, z: 158 } as Spot,
    phone: { out: o + 40 + GATE.w / 2, z: 282 } as Spot,
  };
};

function steps(room: Room): Step[] {
  const { gate, pad, phone } = layout(room);
  const sad = { eyes: 'sleepy' } as const;
  return [
    [0, AT_GATE, (k) => walk(room.hatch, gate, k)],
    // Bonk: into the bars and back, a shake.
    [AT_GATE, BONKED, (k) => at({ out: gate.out + Math.sin(k * 30) * 2.5 * (1 - k), z: gate.z + 8 * arch(span(k, 0, 0.3)) }, { eyes: k < 0.5 ? 'shut' : 'sleepy', gaze: [0, -0.5] })],
    [BONKED, AT_PAD, (k) => walk(gate, pad, k, sad)],
    // Its own press, refused.
    [AT_PAD, PRESSED, (k) => hop(pad, pad, k, 10, { gaze: [-room.side, -0.4] })],
    [PRESSED, REFUSED, (k) => at({ out: pad.out + Math.sin(k * 36) * 3 * (1 - k), z: pad.z }, { eyes: k < 0.5 ? 'shut' : 'sleepy' })],
    // You arm it: it watches the cursor come in, then cheers.
    [REFUSED, SCANNED, (k) => at(pad, { eyes: 'dot', gaze: [room.side * (1 - k), -0.3] })],
    [SCANNED, OPENED, () => at(pad, { eyes: 'wide', gaze: [0, -1] })],
    [OPENED, CHEERED, (k) => hop(pad, pad, k, 26, { eyes: 'happy' })],
    [CHEERED, THROUGH, (k) => (k < 0.4 ? walk(pad, gate, k / 0.4) : walk(gate, phone, (k - 0.4) / 0.6))],
    [THROUGH, TAPPED, (k) => hop(phone, phone, k, 12, { gaze: [0, -1], eyes: k > 0.5 ? 'happy' : 'dot' })],
  ];
}

export const story: Story = {
  rests: [
    [0.15, BONKED],
    [0.32, REFUSED],
    [0.5, CHEERED],
    [0.68, TAPPED],
  ],
  leave: 0.88,
  pose: (sec, room) => play(steps(room), sec),
};

export function stage(room: Room) {
  const { pen, sec } = room;
  const { pal } = pen;
  const { o } = layout(room);
  const z = room.actor?.pose.z ?? 0;

  // The phone it is after, behind the gate.
  const phone = room.box(o + 40 + (GATE.w - PHONE.w) / 2, 0, PHONE.z, PHONE.w, PHONE.h, 6, {
    front: pal.panel2,
    top: pal.panel,
    side: pal.panel2,
    stroke: pal.ink,
  });
  drawScreen(pen, phone.x + 3, phone.y + 4, PHONE.z - 0.5, PHONE.w - 6, PHONE.h - 8, 5, -1, arch(span(sec, THROUGH + 0.1, TAPPED)) * 0.8);
  if (z > GATE.z) room.a07();

  // The gate: up from the scan, down again once A-07 is at the hatch.
  const up = easeInOut(span(sec, SCANNED, OPENED)) * (1 - easeInOut(span(sec, RELOCK, RELOCK + 0.6)));
  const armed = sec >= SCANNED && sec < RELOCK + 0.3;
  drawBars(room, o + 40, GATE.z, GATE.w, GATE.h, up, armed);
  room.a07();

  // The pad on its post: a scan line as you press it, red once armed.
  const post = room.box(o + 6, 0, PAD.z, 8, PAD.post, 8, { front: pal.panel2, top: pal.panel, side: pal.panel2, stroke: pal.ink });
  const face = { x: post.x + 4 - PAD.w / 2, y: post.y - PAD.h };
  pen.box(face.x, face.y, PAD.z - 2, PAD.w, PAD.h, 6, { front: pal.panel, top: pal.panel2, side: pal.panel2, stroke: pal.ink });
  const cx = face.x + PAD.w / 2;
  const cy = face.y + PAD.h / 2 + 2;
  const refused = sec >= PRESSED && sec < CURSOR_IN;
  drawPrint(pen, cx, cy, PAD.z - 2.5, 9, armed ? pal.red : refused ? pal.red : pal.ink);
  const scan = span(sec, CURSOR_DOWN, SCANNED);
  if (scan > 0 && scan < 1) pen.line([face.x + 2, face.y + 3 + scan * (PAD.h - 6), PAD.z - 3], [face.x + PAD.w - 2, face.y + 3 + scan * (PAD.h - 6), PAD.z - 3], pal.accent, 2);
  if (refused) {
    pen.faded(1 - span(sec, REFUSED, CURSOR_IN) * 0.6, () => {
      pen.line([cx - 7, cy - 7, PAD.z - 3], [cx + 7, cy + 7, PAD.z - 3], pal.red, 2.5);
      pen.line([cx + 7, cy - 7, PAD.z - 3], [cx - 7, cy + 7, PAD.z - 3], pal.red, 2.5);
      pen.stamp('NOT BY ITSELF', cx, face.y - 16, PAD.z, pal.red, -0.1, 7);
    });
  }

  // You: a cursor gliding in from the outer edge to press the pad, then away.
  const come = easeInOut(span(sec, REFUSED + 0.2, CURSOR_IN));
  const go = easeInOut(span(sec, SCANNED + 0.2, OPENED + 0.6));
  if (come > 0 && go < 1) {
    const far = room.x(room.margin + 30, PAD.z - 20);
    const x = far + (cx - far) * come + (far - cx) * go;
    const press = arch(span(sec, CURSOR_IN, CURSOR_DOWN));
    drawCursor(pen, x, cy - 2 + 30 * go, PAD.z - 20, 1 - press * 0.2);
    if (come >= 1 && go <= 0) pen.faded(arch(span(sec, CURSOR_IN, SCANNED)), () => pen.tag('you', x + 10, cy - 6, PAD.z - 20));
  }
}
