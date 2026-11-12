// The archive's cast, in the left margin: a tall screen of code scrolling up
// forever, and two cousins reading it, one nodding along in glasses, one
// running a magnifier down the lines.

import { noise } from '../../../seed';
import { cousin } from '../../../species/look';
import { phase } from '../../../species/motion';
import { drawMagnifier } from '../../props';
import type { Room } from '../../room';

const NODDER = cousin('archive:nodder', { size: 24, gear: 'glasses', pose: 'square' });
const CHECKER = cousin('archive:checker', { size: 22, gear: 'cap', pose: 'tall', swap: true });
const SCROLL = { w: 80, h: 150, z: 240 };
const LINE = 9;

export function cast(room: Room) {
  const { pen, t } = room;
  const { pal } = pen;
  const ctx = pen.ctx;
  const o = room.fit(SCROLL.w + 40);
  const at = room.box(o, 0, SCROLL.z, SCROLL.w, SCROLL.h, 10, { front: pal.artBg, top: pal.panel, side: pal.panel2, stroke: pal.ink });

  // The lines, kept inside the glass while they scroll.
  const a = pen.at(at.x + 4, at.y + 4, SCROLL.z);
  const b = pen.at(at.x + SCROLL.w - 4, at.y + SCROLL.h - 4, SCROLL.z);
  ctx.save();
  ctx.beginPath();
  ctx.rect(a.x, a.y, b.x - a.x, b.y - a.y);
  ctx.clip();
  const run = t * 12;
  const first = Math.floor(run / LINE);
  for (let r = 0; r * LINE < SCROLL.h + LINE; r++) {
    const g = first + r;
    const y = at.y + 6 + r * LINE - (run % LINE);
    const indent = Math.floor(noise(g, 3, 1) * 3) * 6;
    const w = (SCROLL.w - 16 - indent) * (0.3 + 0.65 * noise(g, 9, 2));
    const tone = noise(g, 4, 7);
    pen.rect(at.x + 8 + indent, y, w, 3.5, SCROLL.z - 0.5, tone < 0.18 ? pal.red : tone < 0.34 ? pal.accent : pal.artDim);
  }
  ctx.restore();

  const nod = Math.sin(t * 4.5) * 0.04;
  room.unit('archive:nodder', NODDER, { out: o + 22, z: 186, sy: 1 + nod, sx: 1 - nod, gaze: [0, -0.8] });
  const lens = { x: at.x + SCROLL.w * 0.6, y: at.y + 24 + phase(t, 5) * (SCROLL.h - 48), z: SCROLL.z - 36 };
  const out = o + SCROLL.w + 18;
  const checker = room.unit('archive:checker', CHECKER, {
    out,
    z: 176,
    gaze: room.look(out, 0, 176, CHECKER.size * 1.8, lens.x, lens.y, lens.z),
  });
  drawMagnifier(pen, lens.x, lens.y, lens.z, 12, [checker.x - room.side * checker.w * 0.4, checker.top + checker.h * 0.5, 176]);
}
