// CH. 05, beside the Schedules section: the alarm. Before it sleeps, Little
// hands the Clock a note, a task for later, and curls up beside it. The
// night goes by on the Clock's face, its hand running round. At three it
// rings; Little jumps up, does what the note says, all on its own, and the
// note is stamped done.

import { arch, easeInOut, mix, phase, span } from '../../species/motion';
import type { Story } from '../../world/frame';
import { A07 } from '../a07/look';
import { at, hop, play, walk, type Spot, type Step } from '../a07/pose';
import { standApp } from '../characters/app';
import { drawNote } from '../props';
import type { Room } from '../room';

const CLOCK = { size: 24, z: 250 };
const NOTE = 13;

const HANDS = 1.3;
const NOTED = 2.4;
const ASLEEP = 4.4;
const RING = 6.0;
const RANG = 7.2;
const STAMPED = 8.4;
const DONE = 9.0;

const spots = (room: Room) => {
  const o = room.fit(150);
  return {
    clock: { out: o + 30, z: CLOCK.z } as Spot,
    stand: { out: o + 64, z: 222 } as Spot,
    bed: { out: o + 112, z: 236 } as Spot,
  };
};

function steps(room: Room): Step[] {
  const { stand, bed } = spots(room);
  const toClock = [-room.side * 0.8, -0.2] as const;
  return [
    [0, 1.1, (k) => walk(room.hatch, stand, k)],
    [1.1, NOTED, (k) => at(stand, { gaze: toClock, eyes: k > 0.7 ? 'happy' : 'dot' })],
    [NOTED, 3.4, (k) => walk(stand, bed, k)],
    [3.4, ASLEEP, (k) => at(bed, { shape: k > 0.3 ? 'wider' : 'square', eyes: k < 0.6 ? 'happy' : 'shut' })],
    [ASLEEP, RING, () => at(bed, { shape: 'wider', eyes: 'shut' })],
    // The ring: up in one jump, eyes wide, to the Clock.
    [RING, 6.6, (k) => hop(bed, bed, k, 18, { eyes: 'wide', gaze: toClock })],
    [6.6, 7.8, (k) => walk(bed, stand, k)],
    [7.8, DONE, (k) => at(stand, { gaze: k < 0.5 ? [-room.side * 0.6, 0.4] : toClock, eyes: k > 0.5 ? 'happy' : 'dot' })],
  ];
}

export const story: Story = {
  rests: [
    [0.15, NOTED],
    [0.45, DONE],
  ],
  leave: 0.86,
  pose: (sec, room) => {
    const pose = play(steps(room), sec);
    return sec >= ASLEEP && sec < RING ? { ...pose, sy: 0.92 + 0.04 * Math.sin(room.t * 1.2) } : pose;
  },
  narrate: [0, RING],
};

export function draw(room: Room) {
  if (room.side < 0) return;
  const { pen, sec, t } = room;
  const { pal } = pen;
  const { clock, stand, bed } = spots(room);

  // The Clock, awake since Little woke it: it hops as the note lands, its
  // hand runs round through the night, and at three it rings.
  const caught = span(sec, NOTED - 0.2, NOTED + 0.4);
  const ringing = span(sec, RING, RANG);
  const ring = ringing > 0 && ringing < 1;
  const night = easeInOut(span(sec, ASLEEP, RING));
  const b = standApp(room, 'clock', clock.out, clock.z, CLOCK.size, {
    awake: 1,
    hop: caught > 0 && caught < 1 ? caught : ring ? phase(t, 0.32) : null,
    grumble: ring ? 1 : 0,
    gaze: -room.side,
    spin: t + night * 8,
  });
  const cx = b.left + b.w / 2;
  const cy = b.top + b.h * 0.3;
  if (ring) {
    pen.faded(0.55 + 0.45 * Math.sin(t * 30), () => {
      for (const side of [-1, 1]) {
        for (const r of [b.w * 0.8, b.w * 1.05]) {
          const a = side > 0 ? 0 : Math.PI;
          pen.arc(cx, cy, clock.z, r, a - 0.45, a + 0.45, undefined, pal.red, 1.5);
        }
      }
    });
    pen.faded(arch(ringing), () => pen.text('rrring!', cx + room.side * b.w * 0.2, b.top - 12, clock.z, { px: 8, color: pal.red, weight: 600, align: 'center' }));
  }

  // The note: from Little's hands to the Clock's feet, where it waits the night.
  const flight = span(sec, HANDS, NOTED - 0.3);
  const nz = clock.z - 14;
  const rest = { x: room.x(clock.out, nz), y: room.y - NOTE * 0.4 };
  if (flight > 0) {
    const from = { x: room.x(stand.out, stand.z), y: room.y - A07.size * 1.2 };
    const q = easeInOut(flight);
    const x = mix(from.x, rest.x, q);
    const y = mix(from.y, rest.y, q) - arch(flight) * 30;
    drawNote(pen, x, y, mix(stand.z, nz, q), NOTE, flight < 1 ? q * 4 : 0);
  }

  room.a07();

  // Asleep through the night.
  if (sec >= ASLEEP - 0.4 && sec < RING) {
    const x = room.x(bed.out, bed.z);
    const top = room.y - A07.size * 1.1;
    const q = phase(t, 3.2);
    pen.faded(arch(q) * 0.8 * span(sec, ASLEEP - 0.4, ASLEEP), () => pen.text('z', x + q * 10, top - q * 28, bed.z, { px: 7 + q * 5, color: pal.muted, weight: 600 }));
  }

  // Done, without anybody asking.
  const done = span(sec, STAMPED - 0.3, STAMPED);
  if (done > 0) pen.faded(done, () => pen.stamp('DONE', rest.x, rest.y - 16, nz, pal.red, -0.08, 8));
}
