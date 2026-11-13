// The sandpit on Linux's floor: a hole in the deck between two heaps of
// dirt, the dirt flying while someone digs.

import type { Room } from '../../../story/room';
import { arch, phase, span } from '../../../species/motion';
import type { Playground } from '../../playground';
import { Z, floorOf } from '../../toys';
import { DIG, PIT } from '../kinds';

export function drawPit(room: Room, play: Playground, i: number, x: number) {
  const { pen } = room;
  const { pal } = pen;
  const deck = room.y;
  if (pen.cam.y >= deck) return;
  const w = PIT.w / 2;
  const d = PIT.d / 2;
  pen.shape(
    [
      [x - w, deck, Z - d],
      [x + w, deck, Z - d],
      [x + w, deck, Z + d],
      [x - w, deck, Z + d],
    ],
    pal.artBg,
    pal.ink,
  );
  // The dirt dug out of it, heaped either side.
  for (const side of [-1, 1]) {
    const c = x + side * (w + 10);
    pen.shape(
      [...Array(9)].map((_, k) => {
        const a = (k / 8) * Math.PI;
        return [c + Math.cos(a) * 11, deck - Math.sin(a) * 7, Z] as const;
      }),
      pal.panel2,
      pal.ink,
    );
  }
  // Dirt flying while someone digs.
  const digger = play.toys.find((toy) => toy.dig >= 0 && floorOf(toy.y) === i);
  if (!digger) return;
  for (let k = 0; k < 6; k++) {
    const q = phase(digger.dig * 2.4, 1, k / 6);
    const side = k % 2 ? 1 : -1;
    pen.faded(1 - span(digger.dig, DIG - 0.2, DIG), () =>
      pen.rect(x + side * (6 + q * 34) - 2, deck - arch(q) * 44 - 2, 4, 4, Z, pal.muted),
    );
  }
}
