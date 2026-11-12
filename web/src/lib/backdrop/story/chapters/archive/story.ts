// CH. 07, the archive, beside the source section. A-07 hops up and pulls a
// file off the shelf. Unfolded, it is a blueprint of itself: FIG. A-07, its
// two blocks dimensioned. It looks at the drawing, down at itself, and hops
// ("that's me!"), then puts on glasses and reads the code on the back,
// line by line. It keeps the glasses.

import { noise } from '../../../seed';
import { easeOut, span } from '../../../species/motion';
import type { Story } from '../../../world/frame';
import { A07 } from '../../a07/look';
import { at, hop, play, walk, type Spot, type Step } from '../../a07/pose';
import type { Room } from '../../room';

const SHELF = { w: 70, h: 112, d: 30, z: 256 };
const PAGE = { w: 56, h: 70 };
const PLANKS = 3;

const AT_SHELF = 1.3;
const PULLED = 2.3;
const OPEN = 2.9;
const LOOKED = 4.3;
const PROUD = 4.9;
const GLASSES = 5.4;
const READ = 7.6;

const layout = (room: Room) => {
  const o = room.fit(SHELF.w + 50);
  return { o, spot: { out: o + SHELF.w + 26, z: 206 } as Spot };
};

function steps(room: Room): Step[] {
  const { spot } = layout(room);
  const shelf = [-room.side, -0.8] as const;
  return [
    [0, AT_SHELF, (k) => walk(room.hatch, spot, k)],
    [AT_SHELF, PULLED, (k) => hop(spot, spot, k, 40, { gaze: shelf })],
    [PULLED, OPEN, () => at(spot, { gaze: [0, -1] })],
    // The drawing, then itself, then the drawing again: it's me.
    [
      OPEN,
      LOOKED,
      (k) => at(spot, { gaze: k < 0.45 ? [0, -1] : k < 0.75 ? [0, 1] : [0, -1], eyes: k > 0.75 ? 'wide' : 'dot' }),
    ],
    [LOOKED, PROUD, (k) => hop(spot, spot, k, 26, { eyes: 'happy', say: k > 0.2 ? "that's me!" : undefined })],
    [PROUD, GLASSES, (k) => at(spot, { gaze: [0, -1], kit: { glasses: k > 0.5 } })],
    // Reading, eyes running along the lines.
    [GLASSES, READ, (k) => at(spot, { gaze: [Math.sin(k * 26) * 0.8, -0.8], kit: { glasses: true } })],
  ];
}

export const story: Story = {
  rests: [
    [0.15, PULLED],
    [0.38, PROUD],
    [0.6, READ],
  ],
  leave: 0.86,
  pose: (sec, room) => play(steps(room), sec),
  after: { glasses: true },
};

export function stage(room: Room) {
  const { pen, sec } = room;
  const { pal } = pen;
  const { o, spot } = layout(room);

  // The shelf, open at the front, with files standing on its planks; one is
  // missing while A-07 has it.
  const shelf = room.box(o, 0, SHELF.z, SHELF.w, SHELF.h, SHELF.d, { top: pal.panel, side: pal.panel2, stroke: pal.ink });
  const out = sec >= AT_SHELF + 0.4 && sec < READ + 1.2;
  for (let p = 1; p <= PLANKS; p++) {
    const y = shelf.y + (p * SHELF.h) / (PLANKS + 0.4);
    pen.line([shelf.x, y, SHELF.z], [shelf.x + SHELF.w, y, SHELF.z], pal.ink);
    let x = shelf.x + 4;
    for (let k = 0; x < shelf.x + SHELF.w - 8; k++) {
      const w = 5 + noise(p, k, 4) * 4;
      const h = 18 + noise(k, p, 8) * 10;
      const pulled = p === 2 && k === 4;
      if (!(pulled && out)) {
        const tone = noise(p, k, 1);
        pen.rect(x, y - h, w, h, SHELF.z + 6, tone < 0.15 ? pal.red : tone < 0.3 ? pal.accent : tone < 0.65 ? pal.line2 : pal.faint);
      }
      x += w + 1.5;
    }
  }

  room.a07();
  if (sec < AT_SHELF + 0.4 || sec >= READ + 1.2) return;

  // The file: pulled out, opened over its head, folded away when it goes.
  const open = easeOut(span(sec, PULLED, OPEN)) * (1 - span(sec, READ + 0.4, READ + 1.2));
  const z = spot.z - 10;
  const x = room.x(spot.out, z);
  const w = 6 + (PAGE.w - 6) * open;
  const h = 26 + (PAGE.h - 26) * open;
  const y = room.y - A07.size * 1.35 - 30 - h;
  const left = x - w / 2;
  pen.rect(left, y, w, h, z, pal.onPrimary, pal.line2);
  if (open < 0.9) return;
  if (sec < GLASSES) drawBlueprint(room, left, y, z);
  else drawCode(room, left, y, z, span(sec, GLASSES, READ));
}

/** FIG. A-07: its two blocks in outline, an eye each, and a dimension line. */
function drawBlueprint(room: Room, x: number, y: number, z: number) {
  const { pen } = room;
  const { pal } = pen;
  const s = 22;
  const o = s * 0.12;
  const bx = x + (PAGE.w - s - o) / 2;
  const by = y + 16;
  pen.rect(bx + o, by + o, s, s, z, undefined, pal.accent);
  pen.rect(bx, by, s, s, z, undefined, pal.red);
  pen.rect(bx + s * 0.25, by + s * 0.3, s * 0.18, s * 0.26, z, undefined, pal.red);
  pen.rect(bx + s * 0.57, by + s * 0.3, s * 0.18, s * 0.26, z, undefined, pal.red);
  const dy = by + s + o + 7;
  pen.line([bx, dy, z], [bx + s, dy, z], pal.artBg);
  pen.line([bx, dy - 3, z], [bx, dy + 3, z], pal.artBg);
  pen.line([bx + s, dy - 3, z], [bx + s, dy + 3, z], pal.artBg);
  pen.text(String(A07.size), bx + s / 2, dy + 8, z, { px: 6, color: pal.artBg, align: 'center' });
  pen.text('FIG. A-07', x + 5, y + 9, z, { px: 5.5, color: pal.red, track: 0.1, weight: 600 });
}

/** The code on the back, the line it is reading lit. */
function drawCode(room: Room, x: number, y: number, z: number, k: number) {
  const { pen } = room;
  const { pal } = pen;
  const rows = 9;
  const reading = Math.min(rows - 1, Math.floor(k * rows));
  for (let r = 0; r < rows; r++) {
    const indent = (noise(r, 2, 6) < 0.4 ? 1 : 0) * 6;
    const w = (PAGE.w - 12 - indent) * (0.35 + 0.6 * noise(r, 7, 1));
    const tone = r === reading ? pal.accent : noise(r, 1, 3) < 0.2 ? pal.red : pal.artDim;
    pen.rect(x + 6 + indent, y + 7 + r * 6.6, w, 3, z, tone);
  }
  pen.faded(span(k, 0.85, 1), () => pen.stamp('LGTM', x + PAGE.w / 2, y + PAGE.h - 10, z - 1, pal.red, -0.1, 8));
}
