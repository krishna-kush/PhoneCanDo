// The gifts' lines (gifts/kinds.ts), drawn in the right margin floor by
// floor. On the gift's own floor: a socket where the gift is, the line back
// along the deck to the riser, and a note of where it goes ("↓ CH. 06"). On
// the floors between: its stretch of the riser, with a collar where it
// passes each deck. On the tunnel's floor: along the deck to its plug, with
// a note by the riser of where each came from. Unlit, a faint line in the
// gift's own ink; once the tunnel lights it, a wire that glows all along
// its length, through the dark.

import type { Palette } from '../../palette';
import type { P3 } from '../../paint/pen';
import { SLAB, floorY } from '../../world/building';
import type { Frame } from '../../world/frame';
import { secOn } from '../a07/timeline';
import type { Room } from '../room';
import { GROW, LANE, route, slice, within, type Gift, type Route } from './kinds';

/** How far a lit wire's glow reaches each side of it through the dark, world units. */
const GLOW = 16;
const NOTE = { px: 6.5, min: 6, track: 0.08 };

type Line = { gift: Gift; source: number; taker: number; route: Route; grown: number; lit: boolean };

/** Floor i's stretch of every gift's line, in its room in the right margin. */
export function drawGifts(room: Room, f: Frame, i: number) {
  if (room.side < 0) return;
  const lines = linesFor(room, f);
  if (!lines.length) return;
  const ceiling = i === 0 ? 0 : floorY(i - 1) + SLAB;
  const ctx = room.pen.ctx;
  // A floor the camera looks down into from over the slab above it: that
  // slab's cut face hides what stands behind it.
  const cut = i > 0 && f.cam.y < ceiling;
  if (cut) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-1e5, room.pen.at(0, ceiling, 0).y, 2e5, 1e5);
    ctx.clip();
  }
  for (const line of lines) drawLine(room, f, line, i, ceiling);
  if (cut) ctx.restore();
}

/** Every gift given so far, with its line in this margin and how far it has run. */
function linesFor(room: Room, f: Frame): Line[] {
  let taker = -1;
  f.floors.forEach((floor, k) => {
    if (taker < 0 && floor.scene.story?.takes) taker = k;
  });
  const takes = taker >= 0 ? f.floors[taker].scene.story?.takes : undefined;
  if (!takes) return [];
  const lit = secOn(f.timeline, taker, f.clock);
  const lines: Line[] = [];
  f.floors.forEach((floor, source) => {
    const gives = floor.scene.story?.gives;
    const stretch = f.timeline.stretches[source];
    if (!gives || !stretch || source >= taker) return;
    const grown = (f.clock - (stretch.start + gives.at)) * GROW;
    if (grown <= 0) return;
    const r = route(room.x, room.margin, gives.gift, gives.from(room), source, takes.to(room, gives.gift), taker);
    lines.push({ gift: gives.gift, source, taker, route: r, grown: Math.min(grown, r.length), lit: lit >= takes.lights[gives.gift] });
  });
  return lines;
}

/** Each gift's ink, and its dash: the Spark amber, Linux the page's own ink, the crew's notes dashed, the key red. */
function inkOf(gift: Gift, pal: Palette): [string, number[] | undefined] {
  switch (gift) {
    case 'spark':
      return [pal.ink, undefined];
    case 'linux':
      return [pal.fg, undefined];
    case 'crew':
      return [pal.ink, [4, 3]];
    case 'key':
      return [pal.red, undefined];
  }
}

const mark = (i: number) => `CH. ${String(i).padStart(2, '0')}`;

function drawLine(room: Room, f: Frame, line: Line, i: number, ceiling: number) {
  const { pen } = room;
  const { pal } = pen;
  const { route: r, grown, lit } = line;
  const deck = floorY(i);
  const here = within(r, ceiling, deck);
  if (!here || here[0] > grown) return;
  const s0 = here[0];
  const s1 = Math.min(here[1], grown);
  const [ink, dash] = inkOf(line.gift, pal);
  const strength = lit ? 1 : 0.6;
  const [ox, , oz] = r.points[0];
  const [rx, top, rz] = r.points[2];

  if (s1 > s0) {
    const wire = slice(r, s0, s1);
    if (lit) {
      // Lit: a soft glow round the wire, and the dark lifts all along it.
      pen.faded(0.12, () => pen.poly(wire, ink, 9));
      pen.faded(0.3, () => pen.poly(wire, ink, 4));
      room.glow(wire, GLOW);
    }
    pen.faded(strength, () => pen.poly(wire, ink, lit ? 2 : 1, dash));
  }
  // Where it starts: a socket on the deck by the gift.
  if (i === line.source) socket(room, ox, top, oz, ink, strength);
  // Through each deck it goes down, a collar on the deck and one under it.
  const down = r.at[2] + (deck - top);
  if (i >= line.source && i < line.taker && grown >= down && f.cam.y < deck) pen.faded(strength, () => pen.ring(rx, deck, rz, 5, ink));
  if (i > line.source && i <= line.taker && f.cam.y > ceiling) pen.faded(strength, () => pen.ring(rx, ceiling, rz, 5, ink));
  // Where it is going, by the riser on its own floor; where it came from, by the riser on the tunnel's.
  const away = -room.side * 5;
  const align = room.side > 0 ? ('right' as const) : ('left' as const);
  if (i === line.source && grown >= r.at[2]) {
    pen.faded(strength, () => pen.text(`↓ ${mark(line.taker)}`, rx + away, top - 4, rz, { ...NOTE, align, color: pal.muted }));
  }
  if (i === line.taker) {
    const y = deck - 30 - LANE[line.gift] * 11;
    pen.faded(strength, () => pen.text(mark(line.source), rx + away, y, rz, { ...NOTE, align, color: ink }));
    if (grown >= r.length) {
      const [px, py, pz] = r.points[r.points.length - 1];
      socket(room, px, py, pz, ink, strength);
    }
  }
}

/** A socket: a small square flat on a deck, seen while the camera is over it. */
function socket(room: Room, x: number, y: number, z: number, ink: string, strength: number) {
  const { pen } = room;
  if (pen.cam.y >= y) return;
  const r = 4;
  const corners: P3[] = [
    [x - r, y, z - r],
    [x + r, y, z - r],
    [x + r, y, z + r],
    [x - r, y, z + r],
  ];
  pen.faded(strength, () => pen.shape(corners, pen.pal.bg, ink));
}
