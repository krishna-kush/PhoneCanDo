// CH. 04, beside the Crew section: the crew. The agent kinds the page leads
// with walk in one after another, side on, each in its own look, naming
// itself as it arrives, and stay. A note goes hand to hand and lands with
// Little. Then the night: the others lie down to sleep, the first, the one in
// the beanie whose part is to keep watch, turns its back to us at the one
// screen (someone is always awake), and Little curls up beside them, not
// alone anymore.

import { wear } from '../../../../data/wear';
import { cousin } from '../../species/look';
import { arch, easeInOut, mix, span } from '../../species/motion';
import type { Story } from '../../world/frame';
import { A07 } from '../a07/look';
import type { Kind } from '../characters/crew';
import { at, hop, play, walk, type Spot, type Step } from '../a07/pose';
import { drawNote, drawScreen } from '../props';
import type { Room } from '../room';

// If the page leads with no kinds, three cousins move in instead.
const STRANGER_WEAR = [wear({ hat: 'cap' }), wear({ hat: 'antenna', neck: 'bowtie' }), wear({ hat: 'beanie' })];
const STRANGERS: Kind[] = STRANGER_WEAR.map((w, n) => ({ label: '', look: cousin(`crew:${n}`, { size: 22 + n * 3, wear: w }) }));
const WATCH = { w: 26, h: 20, up: 14 };

const SETTLED = 2.6;
const CAUGHT = 3.6;
const NESTED = 5.0;
const ASLEEP = 6.6;

const spots = (room: Room) => {
  const o = room.fit(160);
  return {
    o,
    stand: { out: o + 16, z: 166 } as Spot,
    nest: { out: o + 30, z: 204 } as Spot,
    crew: [
      { out: o + 112, z: 246 },
      { out: o + 64, z: 214 },
      { out: o + 150, z: 198 },
      { out: o + 100, z: 286 },
    ] as Spot[],
  };
};

/**
 * Who moves in, in the order they come: first the one whose part is to keep
 * watch (data/backdrop.ts, crewParts: the fourth, or the last of fewer), then
 * the rest in the page's order.
 */
function cast(room: Room, most: number): Kind[] {
  const all = (room.crew.length ? room.crew : STRANGERS).slice(0, most);
  const watch = Math.min(3, all.length - 1);
  return all.length ? [all[watch], ...all.filter((_, k) => k !== watch)] : [];
}
const arrives = (k: number) => 0.2 + k * 0.45;
/** When member k lies down for the night; the first never does. */
const liesDown = (k: number) => ASLEEP - 1.6 + k * 0.4;

function steps(room: Room): Step[] {
  const { stand, nest } = spots(room);
  const toward = [room.side * 0.9, -0.1] as const;
  return [
    [0, 1.0, (k) => walk(room.hatch, stand, k)],
    [1.0, SETTLED, (k) => at(stand, { gaze: toward, eyes: k > 0.5 ? 'happy' : 'wide' })],
    [SETTLED, CAUGHT, (k) => hop(stand, stand, span(k, 0.6, 1), 12, { gaze: [room.side * 0.6, -0.8] })],
    [CAUGHT, NESTED, (k) => walk(stand, nest, k)],
    [NESTED, ASLEEP, (k) => at(nest, { shape: k > 0.3 ? 'wide' : 'square', eyes: k < 0.75 ? 'happy' : 'shut' })],
  ];
}

export const story: Story = {
  rests: [
    [0.15, CAUGHT],
    [0.45, ASLEEP],
  ],
  leave: 0.85,
  pose: (sec, room) => {
    const pose = play(steps(room), sec);
    return sec >= ASLEEP ? { ...pose, sy: 0.92 + 0.04 * Math.sin(room.t * 1.2) } : pose;
  },
  narrate: [0, CAUGHT],
  // Once the note has gone round, a line runs from behind the one screen on down to the tunnel (story/gifts/).
  gives: { gift: 'crew', at: CAUGHT + 0.3, from: (room) => ({ out: spots(room).crew[0].out, z: spots(room).crew[0].z + 38 }) },
};

export function draw(room: Room) {
  if (room.side < 0) return;
  const { pen, sec, t } = room;
  const { pal } = pen;
  const { stand, crew: places } = spots(room);
  const crew = cast(room, places.length);

  // The one screen, just behind where the first will keep watch, glowing.
  const watcher = places[0];
  const sz = watcher.z + 30;
  room.box(watcher.out - 3, 0, sz + 2, 6, WATCH.up, 2, { front: pal.panel2, stroke: pal.ink });
  const screen = room.box(watcher.out - WATCH.w / 2, WATCH.up, sz, WATCH.w, WATCH.h, 4, { front: pal.panel2, top: pal.panel, side: pal.panel2, stroke: pal.ink });
  drawScreen(pen, screen.x + 2, screen.y + 3, sz - 0.5, WATCH.w - 4, WATCH.h - 6, 3);
  room.light(screen.x + WATCH.w / 2, screen.y + WATCH.h / 2, sz, 60);

  // The crew walk in from the margin's edge, one after another, side on,
  // naming themselves as they come; at night all but the first lie down, and
  // the first turns its back to us, to the screen.
  const order = crew.map((kind, k) => ({ kind, k, spot: places[k] })).sort((a, b) => b.spot.z - a.spot.z);
  for (const { kind, k, spot } of order) {
    const walkIn = easeInOut(span(sec, arrives(k), arrives(k) + 1.2));
    const out = mix(room.margin + 40, spot.out, walkIn);
    const walking = walkIn > 0 && walkIn < 1;
    const asleep = k > 0 && sec >= liesDown(k);
    const watching = k === 0 && sec > CAUGHT;
    const body = room.unit(`crew:${kind.label || k}`, kind.look, {
      out,
      z: spot.z,
      lift: walking ? Math.abs(Math.sin(walkIn * 28)) * 3 : 0,
      pose: asleep ? 'wide' : undefined,
      eyes: asleep ? 'shut' : walkIn < 1 ? 'dot' : 'happy',
      sy: asleep ? 0.92 + 0.04 * Math.sin(t * 1.2 + k) : undefined,
      gaze: walking ? [-room.side, 0] : undefined,
      facing: walking ? 'side' : watching ? 'back' : undefined,
    });
    const named = span(sec, arrives(k) + 1.0, arrives(k) + 1.3) * (1 - span(sec, arrives(k) + 2.6, arrives(k) + 3));
    if (kind.label && named > 0) pen.faded(named, () => pen.tag(kind.label, body.x, body.top - 6, spot.z));
  }

  room.a07();

  // The note, hand to hand: from the last to come, to the first, to Little.
  const legs = span(sec, SETTLED - 0.6, CAUGHT - 0.1);
  if (legs > 0 && legs < 1 && crew.length) {
    const head = (s: Spot, size: number) => [room.x(s.out, s.z), room.y - size * 1.5, s.z] as const;
    const path = [head(places[crew.length - 1], 24), head(places[0], 24), head(stand, A07.size)];
    const n = Math.min(1, Math.floor(legs * 2));
    const q = legs * 2 - n;
    const a = path[n];
    const b = path[n + 1];
    drawNote(pen, mix(a[0], b[0], q), mix(a[1], b[1], q) - arch(q) * 40, mix(a[2], b[2], q), 13, q * 5);
  }
}
