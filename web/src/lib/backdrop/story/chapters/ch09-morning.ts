// CH. 09, beside the footer: light, the end. The train comes out into the
// light: across the page the sun comes up, Mom's house is there on the
// horizon, and from her window a heart rises. On the phone the queued reply goes (sent ✓) and her
// answer comes back. Your idea's card, half written on the first floor, now
// reads in full. The crew sleep in a row, worn out; Little settles by the
// card, the Spark glowing on its head. You look at the phone in your hand as
// if for the first time: it was never only a phone. The phone could.

import { idea, momNote } from '../../../../data/backdrop';
import { arch, easeOut, phase, span } from '../../species/motion';
import type { Story } from '../../world/frame';
import { at, play, walk, type Spot, type Step } from '../a07/pose';
import { drawChat, type Bubble } from '../localui';
import { drawHome } from '../outside/home';
import { drawSun } from '../outside/sun';
import { drawIdeaCard } from '../props';
import type { Room } from '../room';

const CARD = { w: 112, z: 236 };
const PHONE = { w: 60, h: 96, z: 168 };

const AT_CARD = 1.2;
const SENT = 1.8;
const ANSWERED = 2.8;
const ASLEEP = 5.0;
/** You look at the phone in your hand; it comes to you; and the story rests once the last words are in full. */
const LOOKED = 4.4;
const NEVER = 6.0;
const END = NEVER + 3.0;

/** Whether her answer is in on the last floor, so the hearts rise: the playground's apps cheer then (play/draw.ts). */
export const heartUp = (sec: number) => sec >= ANSWERED;

const layout = (room: Room) => {
  const o = room.fit(CARD.w + 90);
  return { o, phone: o + CARD.w + 20, by: { out: o + CARD.w + 6, z: 204 } as Spot };
};

function steps(room: Room): Step[] {
  const { by } = layout(room);
  return [
    [0, AT_CARD, (k) => walk(room.hatch, by, k)],
    [AT_CARD, ANSWERED, (k) => at(by, { gaze: k < 0.5 ? [room.side * 0.9, -0.4] : [-room.side * 0.9, -0.5], eyes: k > 0.6 ? 'happy' : 'wide' })],
    [ANSWERED, ASLEEP, (k) => at(by, { shape: k > 0.4 ? 'wider' : 'square', eyes: k < 0.6 ? 'happy' : 'shut' })],
  ];
}

export const story: Story = {
  rests: [
    [0.1, ANSWERED],
    [0.3, END],
  ],
  leave: 1,
  pose: (sec, room) => {
    const pose = play(steps(room), sec);
    return sec >= ASLEEP ? { ...pose, sy: 0.92 + 0.04 * Math.sin(room.t * 1.1) } : pose;
  },
  narrate: [0, ANSWERED, LOOKED, NEVER],
};

export function draw(room: Room) {
  if (room.side < 0) return;
  const { pen, sec, t } = room;
  const { pal } = pen;
  const { o, phone: phoneOut } = layout(room);

  // The crew, worn out from the night, asleep in a row at the back.
  const beds = [o + 14, o + 62, o + 110, o + 156];
  room.crew.slice(0, beds.length).forEach((kind, k) => {
    const z = 300 - k * 8;
    // One sleeps turned away from us.
    const body = room.unit(`crew:${kind.label}`, kind.look, { out: beds[k], z, shape: 'wider', eyes: 'shut', sy: 0.92 + 0.04 * Math.sin(t * 1.1 + k * 1.7), facing: k === 1 ? 'back' : undefined });
    const q = phase(t, 3.4, k * 0.9);
    pen.faded(arch(q) * 0.8, () => pen.text('z', body.x + q * 10, body.top - 4 - q * 30, z, { px: 7 + q * 5, color: pal.muted, weight: 600 }));
  });

  // Your idea, finished.
  drawIdeaCard(room, o, CARD.z, CARD.w, idea.whole, true);

  // The phone: the reply goes as the signal comes back, and hers comes in.
  const p = room.box(phoneOut, 0, PHONE.z, PHONE.w, PHONE.h, 6, { front: pal.panel2, top: pal.panel, side: pal.panel2, stroke: pal.ink });
  const bubbles: Bubble[] = [
    { from: 'in', text: momNote.asks, at: -1 },
    { from: 'out', text: momNote.reply, at: -1, note: sec >= SENT ? 'sent ✓' : 'queued · no signal' },
  ];
  if (sec >= ANSWERED) bubbles.push({ from: 'in', text: momNote.back, at: ANSWERED });
  drawChat(pen, p.x + 4, p.y + 6, PHONE.z - 0.5, PHONE.w - 8, PHONE.h - 12, { title: 'Mom', bubbles, offline: sec < SENT, typing: sec >= SENT + 0.3 && sec < ANSWERED }, sec, t);

  room.a07();
}

/** Across the page: the sun coming up, Mom's house on the horizon, and a heart rising from her window. */
export function far(room: Room) {
  const { sec } = room;
  const rise = easeOut(span(sec, 0, ASLEEP));
  drawSun(room, rise);
  // Once her answer is in, a heart rises from her window, and another, and another.
  drawHome(room, { mom: 1, heart: sec >= ANSWERED ? phase(room.t, 4) : 0 });
}
