// CH. 06, the loading dock, beside the install steps. A-07 is the one who
// helps now: a crate marked APK comes down on a cable, lands with a thump,
// A-07 knocks and the lid pops, and a newcomer rises out of it, hops down
// and says hi. They hop together; the newcomer stays and watches A-07 go.

import { cousin } from '../../../species/look';
import { arch, easeIn, easeInOut, easeOut, jump, mix, span } from '../../../species/motion';
import type { Story } from '../../../world/frame';
import { at, hop, play, walk, type Spot, type Step } from '../../a07/pose';
import { drawCrate } from '../../props';
import type { Room } from '../../room';

const NEWCOMER = cousin('dock:newcomer', { size: 20, gear: 'none', pose: 'square', swap: true });
const CRATE = { w: 36, h: 30, z: 196 };

const WAITING = 1.1;
const LOWERED = 2.5;
const THUMPED = 2.9;
const AT_CRATE = 3.5;
const KNOCKED = 3.9;
const LID = 4.4;
const RISEN = 4.8;
const OUT = 5.4;
const HI = 6.2;

const layout = (room: Room) => {
  const o = room.fit(CRATE.w + 80);
  return {
    o,
    wait: { out: o + 14, z: 176 } as Spot,
    knock: { out: o + 40, z: 186 } as Spot,
    crate: { out: o + 52 + CRATE.w / 2, z: CRATE.z + 10 } as Spot,
    landing: { out: o + 52 + CRATE.w + 26, z: 178 } as Spot,
  };
};

function steps(room: Room): Step[] {
  const { wait, knock } = layout(room);
  return [
    [0, WAITING, (k) => walk(room.hatch, wait, k, { gaze: [0, -1] })],
    [WAITING, LOWERED, () => at(wait, { gaze: [room.side * 0.6, -1] })],
    [LOWERED, THUMPED, (k) => hop(wait, wait, k, 10, { eyes: 'wide', gaze: [room.side, 0] })],
    [THUMPED, AT_CRATE, (k) => walk(wait, knock, k)],
    [AT_CRATE, KNOCKED, (k) => ({ ...at(knock, { gaze: [room.side, 0] }), out: knock.out + arch(k) * 6 })],
    [KNOCKED, OUT, () => at(knock, { eyes: 'wide', gaze: [room.side * 0.5, -1] })],
    // Two hops together: a high five.
    [OUT, HI, (k) => hop(knock, knock, (k * 2) % 1, 18, { eyes: 'happy', gaze: [room.side, 0] })],
  ];
}

export const story: Story = {
  rests: [
    [0.1, WAITING],
    [0.28, THUMPED],
    [0.48, OUT],
    [0.66, HI],
  ],
  leave: 0.86,
  pose: (sec, room) => play(steps(room), sec),
};

export function stage(room: Room) {
  const { pen, sec } = room;
  const { pal } = pen;
  const { o, crate, landing } = layout(room);
  const z = CRATE.z;
  const left = room.edge(o + 52, z, CRATE.w);

  // The crate comes down on its cable, lands with a thump and a ring of dust.
  const down = easeIn(span(sec, WAITING, LOWERED));
  const lift = 380 * (1 - down);
  const thump = arch(span(sec, LOWERED, THUMPED));
  const h = CRATE.h * (1 - 0.14 * thump);
  const w = CRATE.w * (1 + 0.08 * thump);
  const top = room.y - lift - h;
  const reel = span(sec, THUMPED, THUMPED + 0.8);
  if (reel < 1) pen.line([left + CRATE.w / 2, room.y - 900, z + 12], [left + CRATE.w / 2, top - 600 * easeIn(reel), z + 12], pal.ink, 1, [4, 3]);
  if (thump > 0) pen.faded(1 - span(sec, LOWERED, THUMPED + 0.3), () => pen.ring(left + CRATE.w / 2, room.y, z + CRATE.w * 0.4, 20 + 50 * span(sec, LOWERED, THUMPED + 0.3), pal.line2, 1.5));

  // The newcomer: rising out of the open crate (behind its front), then
  // hopping down beside it, where it stays.
  const rise = easeOut(span(sec, LID - 0.2, RISEN));
  const leap = span(sec, RISEN, OUT);
  const inside = leap < 0.5;
  const drawNewcomer = () => {
    if (rise <= 0) return;
    const j = jump(leap, 24);
    const out = leap > 0 ? mix(crate.out, landing.out, easeInOut(leap)) : crate.out;
    const up = leap > 0 ? mix(CRATE.h - 4, 0, easeIn(leap)) : mix(CRATE.h - NEWCOMER.size * 1.3, CRATE.h - 4, rise);
    room.unit('dock:newcomer', NEWCOMER, {
      out,
      z: mix(crate.z, landing.z, leap),
      up,
      lift: j.lift,
      sx: leap > 0 ? j.sx : undefined,
      sy: leap > 0 ? j.sy : undefined,
      eyes: sec < OUT ? 'wide' : sec < HI + 0.4 ? 'happy' : 'dot',
      // Once out, it watches A-07: as it hops with it, and as it goes.
      gaze: sec >= OUT ? [-room.side, 0] : undefined,
    });
    if (sec >= OUT && sec < HI + 0.8) pen.faded(span(sec, OUT, OUT + 0.2), () => pen.tag('hi!', room.x(out, landing.z), room.y - 34, landing.z));
  };
  if (inside) drawNewcomer();
  drawCrate(pen, left - (w - CRATE.w) / 2, top, z, w, h, 'APK', pal.red);

  // The lid, knocked off and away.
  const pop = span(sec, KNOCKED, LID + 0.4);
  if (pop < 1) {
    pen.faded(1 - span(pop, 0.6, 1), () =>
      pen.box(left - 2 + pop * 30 * room.side, top - 4 - arch(pop) * 30 - pop * 10, z - 1, CRATE.w + 4, 4, CRATE.w * 0.84, {
        front: pal.panel2,
        top: pal.panel,
        side: pal.panel2,
        stroke: pal.ink,
      }),
    );
  }
  if (!inside) drawNewcomer();
  room.a07();
}
