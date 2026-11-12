// CH. 08, the fine print, beside the FAQ. A-07 has questions: question
// marks rise off it one after another. It kicks the die, which tumbles
// across the floor and comes up with a number (the question it rolled), and
// a red "!" pops over its head: answered.

import { arch, easeOut, phase, span } from '../../../species/motion';
import type { Story } from '../../../world/frame';
import { A07 } from '../../a07/look';
import { at, hop, play, walk, type Spot, type Step } from '../../a07/pose';
import type { Room } from '../../room';
import { drawDie } from './die';

const HALF = 13;
const DIE_Z = 176;

const ARRIVED = 1.1;
const ASKED = 2.7;
const CROUCHED = 3.0;
const KICKED = 3.4;
const ROLLED = 4.6;
const BACK = 5.0;
const ANSWERED = 5.8;

const layout = (room: Room) => {
  const o = room.fit(130);
  return { o, spot: { out: o + 24, z: 168 } as Spot, from: o + 66, to: o + 112 };
};

function steps(room: Room): Step[] {
  const { spot } = layout(room);
  const kick: Spot = { out: spot.out + 16, z: spot.z };
  return [
    [0, ARRIVED, (k) => walk(room.hatch, spot, k)],
    [ARRIVED, ASKED, (k) => at(spot, { gaze: [Math.sin(k * 9) * 0.8, -0.6] })],
    [ASKED, CROUCHED, (k) => at(spot, { sx: 1 + 0.15 * k, sy: 1 - 0.15 * k, gaze: [room.side, 0.3] })],
    [CROUCHED, KICKED, (k) => hop(spot, kick, k, 14, { gaze: [room.side, 0.3] })],
    [KICKED, ROLLED, () => at(kick, { gaze: [room.side, 0], eyes: 'wide' })],
    [ROLLED, BACK, (k) => walk(kick, spot, k, { gaze: [room.side, 0] })],
    [BACK, ANSWERED, (k) => hop(spot, spot, k, 28, { eyes: 'happy' })],
  ];
}

export const story: Story = {
  rests: [
    [0.15, ASKED],
    [0.38, BACK],
    [0.6, ANSWERED],
  ],
  leave: 0.86,
  pose: (sec, room) => play(steps(room), sec),
};

export function stage(room: Room) {
  const { pen, sec, t } = room;
  const { pal } = pen;
  const { spot, from, to } = layout(room);

  // The die: two quarter rolls across the floor and a tumble toward you.
  const roll = easeOut(span(sec, KICKED, ROLLED));
  const out = from + (to - from) * roll;
  const x = room.x(out, DIE_Z);
  const y = room.y - HALF - arch(roll) * 22;
  const facing = drawDie(pen, [x, y, DIE_Z], HALF, (roll * Math.PI) / 2, room.side * roll * Math.PI);
  if (sec >= ROLLED) pen.faded(span(sec, ROLLED, ROLLED + 0.3), () => pen.tag(`Q${facing}`, x, y - HALF - 4, DIE_Z));

  room.a07();

  // Its questions, rising off it one after another, and the answer.
  const head = room.x(spot.out, spot.z);
  const top = room.y - A07.size * 1.9;
  const asking = span(sec, ARRIVED, ASKED);
  if (asking > 0 && sec < ROLLED) {
    for (let n = 0; n < 3; n++) {
      const q = sec < ASKED ? span(asking, n * 0.25, n * 0.25 + 0.6) : phase(t, 2.4, n * 0.8);
      if (q <= 0 || q >= 1) continue;
      pen.faded(arch(q), () =>
        pen.text('?', head + Math.sin(q * 6 + n) * 6 + (n - 1) * 10, top - q * 40, spot.z, { serif: true, px: 20, color: pal.ink, align: 'center' }),
      );
    }
  }
  const bang = span(sec, BACK, BACK + 0.3);
  if (bang > 0) pen.text('!', head, top - 10 - easeOut(bang) * 14, spot.z, { serif: true, px: 26, color: pal.red, align: 'center' });
}
