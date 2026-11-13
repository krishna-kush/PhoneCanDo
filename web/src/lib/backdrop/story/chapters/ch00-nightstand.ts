// CH. 00, beside the hero: a phone, at night, a few stars behind it.
// Little lies asleep beside your half-written idea; it wakes, finds the idea,
// looks out at you, and slumps. It wanted to help; it was only a phone.

import { noise } from '../../seed';
import { arch, easeInOut, phase, span } from '../../species/motion';
import type { Story } from '../../world/frame';
import { at, play, walk, type Spot, type Step } from '../a07/pose';
import { idea } from '../../../../data/backdrop';
import { drawIdeaCard } from '../props';
import type { Room } from '../room';

const IDEA = { w: 82, z: 236 };

const AWAKE = 2.4;
const LOOKED = 3.2;
const FOUND = 4.2;
const FACED = 5.2;
const SLUMPED = 6.4;

const spots = (room: Room) => {
  const o = room.fit(IDEA.w + 60);
  return { o, bed: { out: o + 16, z: 170 } as Spot, idea: { out: o + IDEA.w + 34, z: 206 } as Spot };
};

function steps(room: Room): Step[] {
  const { bed, idea } = spots(room);
  return [
    // Asleep, flat on the glass.
    [0, 1.6, () => at(bed, { shape: 'wider', eyes: 'shut', sy: 0.92 + 0.04 * Math.sin(room.t * 1.2) })],
    // Waking: eyes first, then up.
    [1.6, AWAKE, (k) => at(bed, { shape: k > 0.6 ? 'square' : 'wider', eyes: k < 0.5 ? 'sleepy' : 'dot', sy: k > 0.6 ? 1.06 : 0.94 })],
    [AWAKE, LOOKED, (k) => at(bed, { gaze: [Math.sin(k * 7) * 0.9, -0.2] })],
    [LOOKED, FOUND, (k) => walk(bed, idea, k)],
    // It looks from the idea out to you…
    [FOUND, FACED, (k) => at(idea, { gaze: k < 0.5 ? [-room.side * 0.7, -0.7] : [0, 0.1], eyes: 'wide' })],
    // …and slumps: only a phone.
    [FACED, SLUMPED, (k) => at(idea, { gaze: [0, 0.6], eyes: 'sleepy', sy: 1 - 0.1 * easeInOut(k), sx: 1 + 0.06 * easeInOut(k) })],
  ];
}

export const story: Story = {
  rests: [
    [0, 1.6],
    [0.22, FOUND],
    [0.45, SLUMPED],
  ],
  leave: 0.8,
  pose: (sec, room) => play(steps(room), sec),
  narrate: [0, 1.6, FOUND],
};

export function draw(room: Room) {
  if (room.side < 0) return;
  const { o } = spots(room);
  // Your idea, left half-written on the glass.
  drawIdeaCard(room, o, IDEA.z, IDEA.w, idea.half, false);
  room.a07();
}

/** Far behind everything on Little's side: a few stars. */
export function far(room: Room) {
  if (room.side < 0) return;
  const { pen, t } = room;
  const { pal } = pen;
  const z = 2600;
  for (let k = 0; k < 12; k++) {
    const out = noise(k, 1, 2) * room.margin;
    const up = 700 + noise(k, 3, 4) * 1100;
    const twinkle = arch(span(phase(t, 3 + noise(k, 5, 6) * 3, k), 0, 1));
    pen.faded(0.3 + 0.5 * twinkle, () => pen.rect(room.x(out, z), room.y - up, 6, 6, z, k % 5 ? pal.fg : pal.accent));
  }
}
