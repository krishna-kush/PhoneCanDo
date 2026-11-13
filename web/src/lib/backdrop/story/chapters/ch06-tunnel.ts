// CH. 06, beside the install steps: the tunnel, the story's dark hour, where
// the task and the idea meet. The train goes into the tunnel: the world goes
// dark in both margins, where only lit things show. No signal. Your touch turns
// the key (the fingerprint on the phone glows and arms it). Little wakes
// Messages and writes to Mom (the reply waits, queued, for a signal), while
// the crew, each kind its own part, build your idea at the terminal, by the
// light of the Spark and the screens. They work side on to the terminal;
// the one who checks it twice holds a clipboard, the one who keeps watch
// wears a headlamp that shines through the dark.

import { crewParts, momNote } from '../../../../data/backdrop';
import { arch, jump, phase, span } from '../../species/motion';
import type { Story } from '../../world/frame';
import { at, hop, play, walk, type Spot, type Step } from '../a07/pose';
import { drawChat, type Bubble } from '../localui';
import type { Body } from '../../paint/unit';
import { drawTerminal } from '../props';
import type { Room } from '../room';

const PHONE = { w: 76, h: 126, z: 116 };
const TERM = { w: 64, h: 46, z: 236 };

const DARK = 1.8;
const ASKED = 2.4;
const ARMED = 3.6;
const WRITING = 3.9;
const SENT = 5.0;
const BUILT = 9.0;
const DONE = 9.6;

const layout = (room: Room) => {
  const o = room.fit(PHONE.w + 110);
  return {
    o,
    term: o + PHONE.w + 30,
    seat: { out: o + PHONE.w + 22, z: 120 } as Spot,
    crew: [
      { out: o + PHONE.w + 110, z: 250 },
      { out: o + PHONE.w + 64, z: 290 },
      { out: o + PHONE.w + 140, z: 296 },
      { out: o + PHONE.w + 20, z: 310 },
    ] as Spot[],
  };
};

/** When crew member k does its part, of [n]. */
const turn = (k: number, n: number) => SENT + 0.4 + (k * (BUILT - SENT - 1)) / Math.max(1, n);

function steps(room: Room): Step[] {
  const { seat } = layout(room);
  const phone = [-room.side * 0.9, -0.6] as const;
  const typing = (k: number) => (Math.floor(k * 40) % 2 ? 1.05 : 0.96);
  return [
    [0, 1.2, (k) => walk(room.hatch, seat, k)],
    // The dark comes down: it looks round.
    [1.2, ASKED, (k) => at(seat, { gaze: [Math.sin(k * 8) * 0.9, -0.4], eyes: 'wide' })],
    [ASKED, WRITING, () => at(seat, { gaze: phone, eyes: 'wide' })],
    // Writing to Mom.
    [WRITING, SENT, (k) => at(seat, { gaze: phone, sy: typing(k), sx: 2 - typing(k) })],
    // Then watching the crew build, an eye on each part as it lands.
    [SENT, BUILT, (k) => at(seat, { gaze: Math.floor(k * 8) % 2 ? [room.side, -0.3] : phone })],
    [BUILT, DONE, (k) => hop(seat, seat, k, 26, { eyes: 'happy' })],
  ];
}

export const story: Story = {
  rests: [
    [0.12, ASKED],
    [0.35, SENT],
    [0.58, DONE],
  ],
  leave: 0.86,
  pose: (sec, room) => play(steps(room), sec),
  narrate: [0, ASKED, SENT],
  // The lines the floors above sent down (story/gifts/) plug in here: the
  // key's into the phone, lit as your touch arms it; the others into the
  // terminal's back, lit as the build begins, the Spark's first.
  takes: {
    to: (room, gift) => {
      const { o, term } = layout(room);
      if (gift === 'key') return { out: o + PHONE.w / 2, z: PHONE.z + 8 };
      const across = gift === 'spark' ? -8 : gift === 'linux' ? 0 : 8;
      return { out: term + TERM.w / 2 + across, z: TERM.z + TERM.h * 0.45 };
    },
    lights: { key: ARMED, spark: SENT, linux: SENT + 0.3, crew: SENT + 0.6 },
  },
};

/** How dark it is: down as the train goes in, up again as Little leaves the floor. */
const darkness = (sec: number) => span(sec, 0.4, DARK) * (1 - span(sec, DONE + 0.6, DONE + 1.6));

export function draw(room: Room) {
  const { sec } = room;
  room.dark(darkness(sec));
  if (room.side < 0) return;
  const { pen, t, crew } = room;
  const { pal } = pen;
  const { o, term, crew: places } = layout(room);

  // The crew at the terminal, each doing its part for your idea in turn:
  // a hop, and its name and part on a callout.
  const order = crew.map((kind, k) => ({ kind, k, spot: places[k % places.length] })).sort((a, b) => b.spot.z - a.spot.z);
  for (const { kind, k, spot } of order) {
    const mine = turn(k, crew.length);
    const j = sec >= BUILT ? jump(span(sec, BUILT, DONE), 20) : jump(span(sec, mine, mine + 0.9), 16);
    const gaze = room.look(spot.out, 0, spot.z, kind.look.size, room.x(term, TERM.z), room.y - 30, TERM.z);
    const body = room.unit(`crew:${kind.label}`, kind.look, {
      out: spot.out,
      z: spot.z,
      lift: j.lift,
      sx: j.sx,
      sy: j.sy,
      eyes: sec >= BUILT ? 'happy' : sec > DARK ? 'wide' : 'dot',
      gaze,
      facing: sec < BUILT ? 'side' : undefined,
    });
    drawTool(room, k % crewParts.length, body, gaze[0] < 0 ? -1 : 1, sec >= BUILT);
    const said = span(sec, mine, mine + 0.3) * (1 - span(sec, mine + 2.2, mine + 2.6));
    if (said > 0) pen.faded(said, () => pen.tag(`${kind.label} · ${crewParts[k % crewParts.length]}`, body.x, body.top - 6, spot.z));
  }

  // The terminal: your idea, building.
  const tx = room.edge(term, TERM.z, TERM.w);
  const ty = room.y - TERM.h - 7;
  const lines: { text: string; color?: string }[] = [];
  if (sec >= SENT) lines.push({ text: '$ build my-idea', color: pal.accent });
  crew.forEach((_, k) => {
    if (sec >= turn(k, crew.length) + 0.6) lines.push({ text: `✓ ${crewParts[k % crewParts.length]}`, color: pal.artDim });
  });
  if (sec >= BUILT) lines.push({ text: '✓ built · on device', color: pal.accent });
  drawTerminal(pen, tx, ty, TERM.z, TERM.w, TERM.h, lines.slice(-4), sec < BUILT && phase(t, 1) < 0.55);
  if (sec >= SENT) room.light(tx + TERM.w / 2, ty + TERM.h / 2, TERM.z, 90);

  // The phone: your fingerprint arms it, then Messages, Mom's note and the reply.
  const phone = room.box(o, 0, PHONE.z, PHONE.w, PHONE.h, 8, { front: pal.panel2, top: pal.panel, side: pal.panel2, stroke: pal.ink });
  const glass = { x: phone.x + 5, y: phone.y + 8, w: PHONE.w - 10, h: PHONE.h - 16 };
  const bubbles: Bubble[] = [{ from: 'in', text: momNote.asks, at: -1 }];
  if (sec >= SENT) bubbles.push({ from: 'out', text: momNote.reply, at: SENT, note: 'queued · no signal' });
  drawChat(pen, glass.x, glass.y, PHONE.z - 0.5, glass.w, glass.h, { title: 'Mom', bubbles, offline: true, typing: sec >= WRITING && sec < SENT }, sec, t);
  const touch = arch(span(sec, ASKED, ARMED + 0.4));
  if (touch > 0) drawTouch(room, glass.x + glass.w / 2, glass.y + glass.h * 0.55, PHONE.z - 1, touch, sec >= ARMED);
  if (sec >= ASKED) room.light(phone.x + PHONE.w / 2, phone.y + PHONE.h / 2, PHONE.z, 110);

  room.a07();
}

/**
 * What a crew member works with, by its part: the one who checks it twice
 * (part 2) a clipboard held out front; the one who keeps watch (part 3) a
 * headlamp on its beanie, lighting the dark.
 */
function drawTool(room: Room, part: number, b: Body, toward: -1 | 1, front: boolean) {
  const { pen } = room;
  const { pal } = pen;
  const S = b.size;
  if (part === 2) {
    const x = front ? b.x + S * 0.3 : toward > 0 ? b.left + b.w + S * 0.05 : b.left - S * 0.45;
    const y = b.top + b.h * 0.4;
    pen.rect(x, y, S * 0.4, S * 0.52, b.z - 1, pal.bg, pal.ink);
    pen.rect(x + S * 0.12, y - S * 0.05, S * 0.16, S * 0.09, b.z - 1, pal.ink);
    for (let k = 0; k < 3; k++) pen.rect(x + S * 0.07, y + S * (0.14 + k * 0.11), S * 0.26, S * 0.03, b.z - 1, pal.line2);
  } else if (part === 3) {
    const x = front ? b.x : toward > 0 ? b.left + b.w * 0.8 : b.left + b.w * 0.2;
    const y = b.top - S * 0.08;
    pen.rect(x - S * 0.07, y - S * 0.07, S * 0.14, S * 0.14, b.z - 1, pal.accent);
    room.light(x, y, b.z, 70);
  }
}

/** Your touch on the glass: a fingerprint glowing up, red once it has armed the phone. */
function drawTouch(room: Room, x: number, y: number, z: number, k: number, armed: boolean) {
  const { pen } = room;
  const { pal } = pen;
  pen.faded(k, () => {
    pen.faded(0.35, () => pen.circle(x, y, z, 26, pal.accent));
    for (let r = 1; r <= 4; r++) pen.arc(x, y, z, r * 4.5, Math.PI * 0.8, Math.PI * 2.2, undefined, armed ? pal.red : pal.accent, 1.5);
    if (armed) pen.stamp('ARMED', x, y + 30, z, pal.red, -0.08, 8);
  });
}
