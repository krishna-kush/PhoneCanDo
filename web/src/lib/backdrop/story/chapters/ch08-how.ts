// CH. 08, beside the FAQ: how? The apps Little woke come and gather round
// it, awake now, a question mark over each. Little answers with three small
// hops: I asked, I learned, I stayed; at the last the question marks turn to
// a hop of their own.

import { arch, easeInOut, mix, phase, span } from '../../species/motion';
import type { Story } from '../../world/frame';
import { standApp, type AppKind } from '../characters/app';
import { at, hop, play, walk, type Spot, type Step } from '../a07/pose';
import type { Room } from '../room';

const CAME = 3.0;
const ANSWERED = 6.0;
const SIZE = 24;

const layout = (room: Room) => {
  const o = room.fit(170);
  return {
    o,
    centre: { out: o + 80, z: 176 } as Spot,
    // Where the apps come to stand, round Little, and the margin's edge they come from.
    apps: [
      { kind: 'messages', out: o + 30, z: 210 },
      { kind: 'clock', out: o + 130, z: 214 },
      { kind: 'settings', out: o + 80, z: 252 },
      { kind: 'notes', out: o + 22, z: 268 },
      { kind: 'music', out: o + 146, z: 270 },
    ] as { kind: AppKind; out: number; z: number }[],
  };
};

function steps(room: Room): Step[] {
  const { centre } = layout(room);
  return [
    [0, 1.2, (k) => walk(room.hatch, centre, k)],
    [1.2, CAME, (k) => at(centre, { gaze: [Math.sin(k * 6) * 0.8, -0.3], eyes: 'wide' })],
    // I asked. I learned. I stayed.
    [
      CAME,
      ANSWERED,
      (k) => {
        const n = Math.min(2, Math.floor(k * 3));
        return hop(centre, centre, k * 3 - n, 12 + n * 5, { gaze: [0, 0.1], eyes: n === 2 ? 'happy' : 'dot' });
      },
    ],
  ];
}

export const story: Story = {
  rests: [
    [0.15, CAME],
    [0.45, ANSWERED],
  ],
  leave: 0.86,
  pose: (sec, room) => play(steps(room), sec),
  narrate: [0, CAME],
};

export function draw(room: Room) {
  if (room.side < 0) return;
  const { pen, sec, t } = room;
  const { pal } = pen;
  const { apps, centre } = layout(room);
  // The apps walk in from the margin's edge, one after another, and gather.
  const order = apps.map((a, k) => ({ ...a, k })).sort((a, b) => b.z - a.z);
  for (const a of order) {
    const come = easeInOut(span(sec, 0.3 + a.k * 0.3, 1.5 + a.k * 0.3));
    const out = mix(room.margin + 40, a.out, come);
    const cheer = sec > ANSWERED - 0.4 ? span(sec, ANSWERED - 0.4 + a.k * 0.08, ANSWERED + 0.2 + a.k * 0.08) : 0;
    const b = standApp(room, a.kind, out, a.z, SIZE, {
      awake: 1,
      hop: come > 0 && come < 1 ? (come * 4) % 1 : cheer > 0 && cheer < 1 ? cheer : null,
      gaze: Math.sign(centre.out - a.out) * room.side,
    });
    // Its question, over it, until the answer.
    const asking = span(sec, 1.2 + a.k * 0.2, 1.8 + a.k * 0.2) * (1 - span(sec, ANSWERED - 0.6, ANSWERED));
    if (asking > 0) {
      const bob = Math.sin(t * 2 + a.k) * 2;
      pen.faded(asking, () => pen.text('?', b.left + b.w / 2, b.top - 6 + bob, a.z, { serif: true, px: 18, color: pal.ink, align: 'center' }));
    }
    // And when it is answered, a small spark of joy.
    const joy = arch(span(sec, ANSWERED - 0.3, ANSWERED + 0.7));
    if (joy > 0) pen.faded(joy * (0.6 + 0.4 * Math.abs(Math.sin(phase(t, 0.5) * Math.PI))), () => pen.text('!', b.left + b.w / 2, b.top - 8, a.z, { serif: true, px: 18, color: pal.red, align: 'center' }));
  }
  room.a07();
}
