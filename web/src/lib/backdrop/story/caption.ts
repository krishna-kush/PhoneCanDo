// A chapter's caption over its floor, in the right margin: "CH. 03" in red,
// then the sentence, set like a figure caption on a plate of the page's
// ground, with a dashed leader down to A-07 while it is on the floor.

import type { Body } from '../paint/unit';
import type { Room } from './room';

/** Where the plate's bottom sits over the floor, world units. */
const UP = 440;
const PX = 9;
const INSET = 14;
const MAX_W = 230;

export function drawCaption(room: Room, n: number, text: string, a07: Body | null) {
  const { pen } = room;
  const { pal } = pen;
  const width = Math.min(MAX_W, room.margin - INSET * 2);
  if (width < 70) return;
  const type = { px: PX, track: 0.02 };
  const lines = wrap(text, width - 16, (s) => pen.measure(s, 0, type));
  const lead = PX * 1.55;
  const h = lead * (lines.length + 1) + 10;
  const x = room.edge(room.margin - INSET - width, 0, width);
  const top = room.y - UP - h;
  if (a07) {
    pen.faded(0.7, () =>
      pen.line([x + 14, top + h, 0], [a07.x, a07.top - a07.size * 0.9, a07.z], pal.ink, 1, [3, 3]),
    );
  }
  pen.rect(x, top, width, h, 0, pal.bg, pal.line2);
  pen.rect(x, top, 3, h, 0, pal.red);
  pen.text(`CH. ${String(n).padStart(2, '0')}`, x + 10, top + 5 + lead * 0.75, 0, {
    px: PX - 1,
    color: pal.red,
    track: 0.16,
    weight: 600,
  });
  lines.forEach((line, k) => pen.text(line, x + 10, top + 5 + lead * (k + 1.75), 0, { ...type, color: pal.fg }));
}

/** Words to lines no wider than [width] by [measure]. */
function wrap(text: string, width: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
