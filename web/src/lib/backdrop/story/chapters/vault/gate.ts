// The vault's gate and the cursor that stands for you, shared by its story
// and its cast.

import type { Pen } from '../../../paint/pen';
import type { Room } from '../../room';

const BARS = 7;

/**
 * A gate [w] by [h] standing at depth z, its sheet-side edge `out` px from
 * the sheet: a frame, bars that slide up into the lintel as [up] runs 0 to 1,
 * a padlock on the bars while it is shut, and a stamp over it.
 */
export function drawBars(room: Room, out: number, z: number, w: number, h: number, up: number, armed: boolean) {
  const { pen } = room;
  const { pal } = pen;
  const frame = room.box(out, 0, z, w, h, 10, { top: pal.panel2, side: pal.panel2, stroke: pal.ink });
  const reach = h * (1 - up * 0.9);
  for (let k = 1; k <= BARS; k++) {
    const x = frame.x + (k * w) / (BARS + 1);
    pen.rect(x - 1.5, frame.y, 3, reach, z, pal.line2);
  }
  pen.rect(frame.x, frame.y, w, 5, z - 1, pal.panel2, pal.ink);
  const cx = frame.x + w / 2;
  if (up < 0.2) {
    // The padlock: a red body and its shackle.
    const y = frame.y + h * 0.42;
    pen.faded(1 - up * 5, () => {
      pen.arc(cx, y, z - 2, 5, Math.PI, Math.PI * 2, undefined, pal.fg, 2);
      pen.rect(cx - 7, y, 14, 11, z - 2, pal.red);
      pen.rect(cx - 1, y + 3, 2, 4, z - 2, pal.artBg);
    });
  }
  pen.stamp(armed ? 'ARMED' : 'LOCKED', cx, frame.y - 14, z, armed ? pal.red : pal.ink, -0.07, 9);
}

/** An arrow cursor, its tip at (x, y). */
export function drawCursor(pen: Pen, x: number, y: number, z: number, scale = 1) {
  const s = 1.3 * scale;
  const pts: [number, number][] = [
    [0, 0],
    [0, 16],
    [4, 12],
    [7, 18.5],
    [10, 17],
    [7, 11],
    [12.5, 11],
  ];
  pen.shape(
    pts.map(([px, py]) => [x + px * s, y + py * s, z] as const),
    pen.pal.fg,
    pen.pal.bg,
    1.5,
  );
}
