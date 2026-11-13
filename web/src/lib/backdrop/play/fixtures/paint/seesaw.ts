// The crew's floor's seesaw: a post on the deck and a plank across it,
// tipped as the physics has it (fixtures/seesaw.ts), and a dashed line up
// from its launching end toward the chute above with an arrow, as a drawing
// marks a part's travel, so you can see where it sends whoever stands there.

import type { Room } from '../../../story/room';
import type { Playground } from '../../playground';
import { SIZE, Z } from '../../toys';
import { LEVER, heightAt, plank, type Seesaw } from '../seesaw';

/** Half the plank's depth, and its edge's thickness. */
const DEEP = 11;
const THICK = 4;
/** How far up the travel line reaches over the plank. */
const TRAVEL = 150;

export function drawSeesaw(room: Room, play: Playground, fx: Seesaw) {
  const { pen } = room;
  const { pal } = pen;
  const p = plank(fx, play.where.span);
  const at = (d: number) => room.x(d * pen.scale(Z), Z);
  const deck = room.y;
  const pivot = at(p.pivot);
  pen.shape(
    [
      [pivot - 9, deck, Z],
      [pivot + 9, deck, Z],
      [pivot, deck - LEVER.post, Z],
    ],
    pal.panel2,
    pal.ink,
  );
  const a = { x: at(p.launch), y: deck - heightAt(fx, -1) };
  const b = { x: at(p.far), y: deck - heightAt(fx, 1) };
  if (pen.cam.y < Math.max(a.y, b.y)) {
    pen.shape(
      [
        [a.x, a.y, Z - DEEP],
        [b.x, b.y, Z - DEEP],
        [b.x, b.y, Z + DEEP],
        [a.x, a.y, Z + DEEP],
      ],
      pal.panel,
      pal.ink,
    );
  }
  pen.shape(
    [
      [a.x, a.y, Z - DEEP],
      [b.x, b.y, Z - DEEP],
      [b.x, b.y + THICK, Z - DEEP],
      [a.x, a.y + THICK, Z - DEEP],
    ],
    pal.panel2,
    pal.ink,
  );
  // Where the launching end sends you: up.
  const top = a.y - SIZE - 10;
  pen.faded(0.4, () => {
    pen.line([a.x, top, Z], [a.x, top - TRAVEL, Z], pal.ink, 1, [3, 4]);
    pen.line([a.x - 4, top - TRAVEL + 6, Z], [a.x, top - TRAVEL, Z], pal.ink);
    pen.line([a.x + 4, top - TRAVEL + 6, Z], [a.x, top - TRAVEL, Z], pal.ink);
  });
}
