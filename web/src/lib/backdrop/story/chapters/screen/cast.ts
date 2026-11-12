// The screen's cast, in the left margin: a cousin in glasses reads a phone
// through a magnifier, row by row, and taps the row it wanted; behind it a
// courier carries a copied note out and back (shares, the clipboard).

import { cousin } from '../../../species/look';
import { arch, easeInOut, jump, mix, phase, span, stepLift } from '../../../species/motion';
import { drawMagnifier, drawNote, drawScreen } from '../../props';
import type { Room } from '../../room';

const READER = cousin('screen:reader', { size: 28, gear: 'glasses', pose: 'square' });
const COURIER = cousin('screen:courier', { size: 20, gear: 'cap', pose: 'square' });
const PHONE = { w: 62, h: 104, z: 200 };
const ROWS = 7;

export function cast(room: Room) {
  const { pen, t } = room;
  const { pal } = pen;
  const o = room.fit(150);

  // The courier, at the back: out with a note, a hop, and back.
  const c = phase(t, 7);
  const there = easeInOut(span(c, 0.05, 0.42));
  const back = easeInOut(span(c, 0.55, 0.92));
  const walking = (c > 0.05 && c < 0.42) || (c > 0.55 && c < 0.92);
  const cout = mix(o + 10, o + 150, there - back);
  const j = jump(span(c, 0.44, 0.53), 16);
  const courier = room.unit('screen:courier', COURIER, {
    out: cout,
    z: 330,
    lift: walking ? stepLift(t * 40) : j.lift,
    sx: j.sx,
    sy: j.sy,
    gaze: [c < 0.5 ? room.side : -room.side, 0],
  });
  drawNote(pen, courier.x, courier.top - 12 - (walking ? 0 : j.lift * 0.3), 330, 14, Math.sin(t * 3) * 0.12);

  // The phone, and the reader with its lens running down the rows and up.
  const at = room.box(o, 0, PHONE.z, PHONE.w, PHONE.h, 8, { front: pal.panel2, top: pal.panel, side: pal.panel2, stroke: pal.ink });
  const p = phase(t, 6);
  const sweep = p < 0.5 ? easeInOut(p / 0.5) : 1 - easeInOut((p - 0.5) / 0.5);
  const tap = span(p, 0.46, 0.56);
  drawScreen(pen, at.x + 4, at.y + 6, PHONE.z - 0.5, PHONE.w - 8, PHONE.h - 12, ROWS, Math.min(ROWS - 1, Math.floor(sweep * ROWS)), arch(tap) * 0.45);
  const lens = { x: at.x + PHONE.w / 2, y: at.y + 18 + sweep * (PHONE.h - 36), z: PHONE.z - 30 };
  const out = o + PHONE.w + 30;
  const z = 150;
  const reader = room.unit('screen:reader', READER, {
    out,
    z,
    eyes: tap > 0 && tap < 1 ? 'wide' : 'dot',
    gaze: room.look(out, 0, z, READER.size, lens.x, lens.y, lens.z),
  });
  drawMagnifier(pen, lens.x, lens.y, lens.z, 12, [reader.x - room.side * reader.w * 0.4, reader.top + reader.h * 0.6, z]);
  if (tap > 0) pen.faded(1 - tap, () => pen.circle(lens.x, lens.y, PHONE.z - 1, 4 + 16 * tap, undefined, pal.accent, 1.5));
}
