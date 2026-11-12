// The dock's cast, in the left margin: the first launch. A progress bar
// fills in chunks toward 2 GB while a cousin in a cap sits by with a coffee,
// sipping; when the bar is full it hops.

import { cousin } from '../../../species/look';
import { arch, jump, phase, span } from '../../../species/motion';
import { drawMug } from '../../props';
import type { Room } from '../../room';

const SIPPER = cousin('dock:sipper', { size: 28, gear: 'cap', pose: 'square' });
const BAR = { w: 120, h: 12, d: 16, z: 160 };
const CHUNKS = 13;
const CYCLE = 9;

export function cast(room: Room) {
  const { pen, t } = room;
  const { pal } = pen;
  const o = room.fit(BAR.w);
  const p = phase(t, CYCLE);
  const fill = Math.min(1, Math.floor(span(p, 0.05, 0.78) * (CHUNKS + 1)) / CHUNKS);
  const done = p >= 0.8;

  // The sipper and its mug, behind the bar.
  const out = o + 40;
  const z = 230;
  const sip = arch(span(phase(t, 3.4), 0.2, 0.62));
  const cheer = jump(span(p, 0.8, 0.9), 24);
  const body = room.unit('dock:sipper', SIPPER, {
    out,
    z,
    lift: cheer.lift,
    sx: done ? cheer.sx : undefined,
    sy: done ? cheer.sy : undefined,
    eyes: done && p < 0.95 ? 'happy' : sip > 0.5 ? 'happy' : 'dot',
    gaze: [-room.side * 0.4, 0.3],
  });
  const mug = 12;
  const mx = room.side > 0 ? body.left - mug - 4 : body.left + body.w + 7;
  drawMug(pen, mx, room.y - mug * 1.15 - sip * 18 - cheer.lift, z - 4, mug, t, true, room.side > 0 ? -1 : 1);

  // The bar, in front.
  const bar = room.box(o, 0, BAR.z, BAR.w, BAR.h, BAR.d, { front: pal.panel2, top: pal.panel, side: pal.panel2, stroke: pal.ink });
  if (fill > 0) {
    const w = BAR.w * fill;
    const x = room.side > 0 ? bar.x : bar.x + BAR.w - w;
    pen.box(x, bar.y, BAR.z - 0.5, w, BAR.h, BAR.d, { front: pal.red, top: pal.red, side: pal.red });
  }
  const label = done ? 'READY ✓' : `2 GB · ${Math.round(fill * 100)}%`;
  pen.text(label, bar.x + BAR.w / 2, bar.y - 8, BAR.z, { px: 8, color: done ? pal.red : pal.fg, align: 'center', track: 0.1 });
}
