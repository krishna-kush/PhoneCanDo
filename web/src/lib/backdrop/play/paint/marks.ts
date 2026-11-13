// The marks the toys' tricks leave, drawn on a floor: a note rising off
// Music each time it bounces and over a dancer as it hops; the hole a hard
// hat dug through the deck, dirt flying, closing up again; the messages
// Messages sent on, flying along the floor; and the run of sleepers the last
// throw woke, stamped where the last of them woke.

import { playWords } from '../../../../data/backdrop';
import { span } from '../../species/motion';
import type { Room } from '../../story/room';
import { busy } from '../habits';
import { TRAITS } from '../kinds';
import { HOLE } from '../physics';
import { RUN_SHOWS, type Playground } from '../playground';
import { SIZE, Z, floorOf, type Toy } from '../toys';

/** How long a bounce's note shows, seconds. */
const NOTE = 0.7;

/** Out from the sheet [d] at the toys' depth, as world x. */
const xAt = (room: Room, d: number) => room.x(d * room.pen.scale(Z), Z);

/** A note over a toy whose block's top middle is (x, top): off Music's bounce, or over a dancer. */
export function drawNotes(room: Room, toy: Toy, x: number, top: number, n: number) {
  if (!toy.awake || room.still) return;
  const { pen } = room;
  const trick = TRAITS[toy.kind].trick;
  let k = -1;
  if (trick === 'spring' && toy.bounced < NOTE) k = toy.bounced / NOTE;
  else if (trick === 'dance' && busy(toy) && !toy.grounded) k = 0.5;
  if (k < 0) return;
  const side = n % 2 ? 1 : -1;
  pen.faded(1 - k, () =>
    pen.text('♪', x + side * (8 + k * 6), top - 6 - k * 26, Z, { px: 10, color: pen.pal.accent, align: 'center', serif: true }),
  );
}

/** The holes dug through floor i's deck, and the dirt thrown up as each was dug. */
export function drawDug(room: Room, play: Playground, i: number) {
  const { pen } = room;
  const { pal } = pen;
  if (pen.cam.y >= room.y) return;
  for (const toy of play.toys) {
    const dug = toy.dug;
    if (!dug || dug.i !== i || dug.left <= 0) continue;
    const x = xAt(room, dug.d);
    const r = (SIZE / 2) * span(dug.left, 0, 1);
    pen.shape(
      [
        [x - r, room.y, Z - r],
        [x + r, room.y, Z - r],
        [x + r, room.y, Z + r],
        [x - r, room.y, Z + r],
      ],
      pal.artBg,
      pal.ink,
    );
    const q = span(HOLE - dug.left, 0, 0.5);
    if (q >= 1) continue;
    for (let k = 0; k < 6; k++) {
      const side = k % 2 ? 1 : -1;
      const out = 6 + q * (18 + k * 4);
      const up = Math.sin(q * Math.PI) * (26 + k * 5);
      pen.faded(1 - q, () => pen.rect(x + side * out - 2, room.y - up - 2, 4, 4, Z, pal.muted));
    }
  }
}

/** The messages in flight on floor i: a small speech bubble each, flying along. */
export function drawPings(room: Room, play: Playground, i: number) {
  const { pen } = room;
  const { pal } = pen;
  for (const p of play.pings) {
    if (floorOf(p.y) !== i) continue;
    const x = xAt(room, p.d);
    const y = p.y - SIZE * 0.75;
    pen.faded(1 - span(p.age, 1.2, 1.6), () => {
      pen.rect(x - 7, y - 5, 14, 9, Z, pal.bg, pal.accent);
      pen.line([x - 3, y + 4, Z], [x - 5, y + 8, Z], pal.accent);
    });
  }
}

/** The last throw's run of wakes, stamped over where the last woke, once it is two or more. */
export function drawRun(room: Room, play: Playground, i: number) {
  const { run, now } = play;
  if (run.n < 2 || floorOf(run.y) !== i) return;
  const age = now - run.at;
  if (age > RUN_SHOWS) return;
  const { pen } = room;
  pen.faded(1 - span(age, RUN_SHOWS - 0.4, RUN_SHOWS), () =>
    pen.stamp(playWords.run(run.n), xAt(room, run.d), run.y - SIZE * 2.2 - age * 10, Z, pen.pal.red, -0.1, 11),
  );
}
