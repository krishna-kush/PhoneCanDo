// CH. 07, beside the source section: nothing hidden. You open it up: a
// blueprint unfolds, FIG. A-07, Little drawn in line-work with its
// dimensions, and under it the lines of its code, lit one by one as you read
// them. Little stands by it and lets you.

import { easeOut, span } from '../../species/motion';
import type { Story } from '../../world/frame';
import { noise } from '../../seed';
import { A07 } from '../a07/look';
import { at, play, walk, type Spot, type Step } from '../a07/pose';
import type { Room } from '../room';

const SHEET = { w: 96, h: 122, z: 240 };
const ROWS = 7;

const OPEN = 0.6;
const OPENED = 2.0;
const SHOWN = 2.6;
const READ = 5.6;

const spots = (room: Room) => {
  const o = room.fit(SHEET.w + 50);
  return { o, by: { out: o + SHEET.w + 26, z: 206 } as Spot };
};

function steps(room: Room): Step[] {
  const { by } = spots(room);
  return [
    [0, 1.3, (k) => walk(room.hatch, by, k)],
    [1.3, SHOWN, () => at(by, { gaze: [-room.side * 0.9, -0.6], eyes: 'wide' })],
    // It lets you read: it looks out at you, at ease.
    [SHOWN, READ, (k) => at(by, { gaze: k < 0.3 ? [-room.side * 0.9, -0.3] : [0, 0.1], eyes: k > 0.3 ? 'happy' : 'dot' })],
  ];
}

export const story: Story = {
  rests: [
    [0.15, SHOWN],
    [0.45, READ],
  ],
  leave: 0.86,
  pose: (sec, room) => play(steps(room), sec),
  narrate: [0, SHOWN],
};

export function draw(room: Room) {
  if (room.side < 0) return;
  const { pen, sec } = room;
  const { pal } = pen;
  const { o } = spots(room);
  const open = easeOut(span(sec, OPEN, OPENED));
  if (open > 0) {
    // The sheet unfolds upward from the floor.
    const h = SHEET.h * open;
    const s = room.panel(o, 0, SHEET.z, SHEET.w, h, pal.bg, pal.ink);
    if (open >= 1) {
      drawFigure(room, s.x, s.y);
      const reading = span(sec, SHOWN, READ - 0.4);
      for (let r = 0; r < ROWS; r++) {
        const w = (SHEET.w - 20) * (0.35 + 0.6 * noise(r, 3, 7));
        const indent = noise(r, 9, 1) < 0.4 ? 8 : 0;
        const lit = reading > 0 && r <= Math.floor(reading * ROWS);
        pen.rect(s.x + 10 + indent, s.y + 66 + r * 7.5, w - indent, 3, SHEET.z - 0.5, lit ? pal.ink : pal.line2);
      }
    }
  }
  room.a07();
}

/** FIG. A-07: its two blocks in outline, its eyes and scarf, and its width dimensioned. */
function drawFigure(room: Room, x: number, y: number) {
  const { pen } = room;
  const { pal } = pen;
  const z = SHEET.z - 0.5;
  const s = 26;
  const o = s * 0.12;
  const bx = x + (SHEET.w - s - o) / 2;
  const by = y + 16;
  pen.rect(bx + o, by + o, s, s, z, undefined, pal.ink);
  pen.rect(bx, by, s, s, z, undefined, pal.red);
  pen.rect(bx + s * 0.25, by + s * 0.3, s * 0.18, s * 0.26, z, undefined, pal.red);
  pen.rect(bx + s * 0.57, by + s * 0.3, s * 0.18, s * 0.26, z, undefined, pal.red);
  pen.rect(bx - 1, by + s * 0.62, s + 2, s * 0.15, z, undefined, pal.ink);
  const dy = by + s + o + 8;
  pen.line([bx, dy, z], [bx + s, dy, z], pal.ink);
  pen.line([bx, dy - 3, z], [bx, dy + 3, z], pal.ink);
  pen.line([bx + s, dy - 3, z], [bx + s, dy + 3, z], pal.ink);
  pen.text(String(A07.size), bx + s / 2, dy + 9, z, { px: 6, color: pal.ink, align: 'center' });
  pen.text('FIG. A-07 · LITTLE', x + 6, y + 9, z, { px: 5.5, color: pal.red, track: 0.1, weight: 600 });
}

/** Across the page: a page's sign in the stars, joining up as you read. */