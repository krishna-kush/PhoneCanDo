// The key's floor's padlock at the front of its chute, shaking while apps
// wait for it, its shackle up while it is open; and the lid that shuts that
// chute.

import { playWords } from '../../../../../data/backdrop';
import type { Room } from '../../../story/room';
import { phase } from '../../../species/motion';
import { SLAB, floorY } from '../../../world/building';
import type { Frame } from '../../../world/frame';
import type { Playground } from '../../playground';
import { CHUTE, Z, floorOf, type Box } from '../../toys';

const LOCK = { w: 15, h: 12 };

export function drawPadlock(room: Room, play: Playground, i: number, x: number) {
  const { pen, t, still } = room;
  const { pal } = pen;
  const deck = room.y;
  const z = Z - CHUTE / 2 - 6;
  const shut = play.where.shut[i];
  // Apps waiting at it: it shakes now and then, and a ring goes out from it.
  const waiting = shut && play.toys.some((toy) => toy.awake && floorOf(toy.y) === i && i < play.where.here);
  const q = phase(t, 2.2);
  const shake = waiting && !still && q < 0.18 ? Math.sin(q * 140) * 2 : 0;
  const left = x - LOCK.w / 2 + shake;
  const top = deck - LOCK.h - 2;
  const lift = shut ? 0 : 6;
  if (waiting && !still) pen.faded(1 - q, () => pen.ring(x, top + LOCK.h / 2, z, 12 + q * 22, pal.red, 1.5));
  pen.arc(left + LOCK.w / 2 + (shut ? 0 : 3), top - lift, z, LOCK.w * 0.32, Math.PI, Math.PI * 2, undefined, pal.ink, 2);
  pen.line([left + LOCK.w * 0.18 + (shut ? 0 : 3), top - lift, z], [left + LOCK.w * 0.18 + (shut ? 0 : 3), top, z], pal.ink, 2);
  if (shut) pen.line([left + LOCK.w * 0.82, top - lift, z], [left + LOCK.w * 0.82, top, z], pal.ink, 2);
  pen.rect(left, top, LOCK.w, LOCK.h, z, shut ? pal.accent : pal.panel, pal.ink);
  pen.rect(left + LOCK.w / 2 - 1.5, top + 3.5, 3, 5, z, pal.artBg);
  const a = pen.at(left - 6, top - 14, z);
  const b = pen.at(left + LOCK.w + 6, top + LOCK.h + 4, z);
  const box: Box = { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
  play.locks[i] = box;
  room.clickable(`lock:${i}`, box, playWords.lock, [x, top - 16, z]);
}

/** Floor i's chute shut by its lid, seen from above in the deck or from below: drawn where the open hole would be. */
export function drawLid(f: Frame, i: number, x: number) {
  const { pen, cam } = f;
  const { pal } = pen;
  const r = CHUTE / 2;
  const y = cam.y < floorY(i) ? floorY(i) : floorY(i) + SLAB;
  pen.shape(
    [
      [x - r, y, Z - r],
      [x + r, y, Z - r],
      [x + r, y, Z + r],
      [x - r, y, Z + r],
    ],
    pal.panel2,
    pal.ink,
  );
  pen.line([x - r * 0.6, y, Z - r * 0.6], [x + r * 0.6, y, Z + r * 0.6], pal.line2);
  pen.line([x + r * 0.6, y, Z - r * 0.6], [x - r * 0.6, y, Z + r * 0.6], pal.line2);
}
