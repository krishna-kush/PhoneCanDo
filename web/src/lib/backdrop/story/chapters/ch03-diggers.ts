// CH. 03, beside the Linux section: the Diggers. Two of them walk in from
// the margin's edge, unasked, in hard hats, and dig, side on to the pit: a
// pit opens in the deck, dirt flies, and up out of it comes a whole machine,
// its screen lighting with a prompt. Little watches it all, then hops with
// them.

import { wear } from '../../../../data/wear';
import { noise } from '../../seed';
import { cousin } from '../../species/look';
import { easeInOut, easeOut, jump, mix, span } from '../../species/motion';
import type { Story } from '../../world/frame';
import { at, hop, play, walk, type Spot, type Step } from '../a07/pose';
import { drawTerminal } from '../props';
import type { Room } from '../room';

const DIGGERS = [
  cousin('diggers:1', { size: 26, pose: 'wide', wear: wear({ hat: 'hardhat' }) }),
  cousin('diggers:2', { size: 20, pose: 'tall', wear: wear({ hat: 'hardhat', neck: 'tie' }), swap: true }),
];
const PIT = { w: 54, d: 34, z: 236 };
const MACHINE = { w: 44, h: 34 };

const WATCHING = 1.0;
const ARRIVED = 2.6;
const DUG = 5.6;
const RISEN = 6.6;
const CHEERED = 7.2;
const SHOVEL = 0.6;

const spots = (room: Room) => {
  const o = room.fit(150);
  return {
    o,
    watch: { out: o + 18, z: 150 } as Spot,
    pit: { out: o + 104, z: PIT.z + PIT.d / 2 } as Spot,
    diggers: [{ out: o + 66, z: 214 }, { out: o + 140, z: 222 }] as Spot[],
  };
};

function steps(room: Room): Step[] {
  const { watch, pit } = spots(room);
  const there = [room.side * 0.9, -0.2] as const;
  return [
    [0, WATCHING, (k) => walk(room.hatch, watch, k)],
    [WATCHING, ARRIVED, (k) => at(watch, { gaze: there, eyes: k > 0.5 ? 'happy' : 'wide' })],
    [ARRIVED, DUG, () => at(watch, { gaze: [room.side * 0.9, 0.2] })],
    [DUG, RISEN, () => at(watch, { gaze: room.look(watch.out, 0, watch.z, 30, room.x(pit.out, pit.z), room.y - 30, pit.z), eyes: 'wide' })],
    [RISEN, CHEERED, (k) => hop(watch, watch, k, 26, { eyes: 'happy' })],
  ];
}

export const story: Story = {
  rests: [
    [0.15, ARRIVED],
    [0.45, CHEERED],
  ],
  leave: 0.85,
  pose: (sec, room) => play(steps(room), sec),
  narrate: [0, ARRIVED],
  // From behind the machine's pit, a line runs on down to the tunnel (story/gifts/).
  gives: { gift: 'linux', at: RISEN, from: (room) => ({ out: spots(room).pit.out, z: PIT.z + PIT.d + 6 }) },
};

export function draw(room: Room) {
  if (room.side < 0) return;
  const { pen, sec, t } = room;
  const { pal } = pen;
  const { pit, diggers } = spots(room);
  const ctx = pen.ctx;

  // The pit, opening in the deck as they dig.
  const open = easeOut(span(sec, ARRIVED, DUG - 0.6));
  if (open > 0) {
    const cx = room.x(pit.out, pit.z);
    const w = PIT.w * open;
    const d = PIT.d * open;
    pen.shape(
      [
        [cx - w / 2, room.y, pit.z - d / 2],
        [cx + w / 2, room.y, pit.z - d / 2],
        [cx + w / 2, room.y, pit.z + d / 2],
        [cx - w / 2, room.y, pit.z + d / 2],
      ],
      pal.artBg,
      pal.ink,
    );
  }

  // The machine, rising up out of the pit: cut off at the deck while it is still below it.
  const rise = easeInOut(span(sec, DUG, RISEN));
  if (rise > 0) {
    const deckY = pen.at(0, room.y, pit.z).y;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-1e4, -1e5, 1e5, deckY + 1e5);
    ctx.clip();
    const x = room.x(pit.out, pit.z) - MACHINE.w / 2;
    const y = room.y - MACHINE.h - 7 + (1 - rise) * (MACHINE.h + 10);
    // Its first words: what it is.
    const lines: { text: string; color?: string }[] = [];
    if (sec >= RISEN - 0.2) lines.push({ text: '$ uname -o', color: pal.accent });
    if (sec >= RISEN + 0.3) lines.push({ text: 'GNU/Linux' });
    drawTerminal(pen, x, y, pit.z, MACHINE.w, MACHINE.h, lines, sec >= RISEN - 0.2 && Math.floor(t * 2) % 2 === 0);
    ctx.restore();
    if (sec >= RISEN - 0.2) room.light(x + MACHINE.w / 2, y + MACHINE.h / 2, pit.z, 80);
  }

  // The Diggers: walking in from the margin's edge, then digging by turns,
  // dirt flying with each stroke, and a hop when the machine is up.
  DIGGERS.forEach((look, k) => {
    const spot = diggers[k];
    const walkIn = easeInOut(span(sec, 0.4 + k * 0.3, ARRIVED - 0.3 + k * 0.2));
    const out = mix(room.margin + 40, spot.out, walkIn);
    const digging = sec > ARRIVED && sec < DUG;
    const stroke = digging ? ((sec - ARRIVED) / SHOVEL + k * 0.5) % 1 : 0;
    const j = digging ? jump(stroke, 10) : jump(span(sec, RISEN, CHEERED), 22);
    const walking = walkIn > 0 && walkIn < 1;
    room.unit(`diggers:${k + 1}`, look, {
      out,
      z: spot.z,
      lift: walking ? Math.abs(Math.sin(walkIn * 30)) * 3 : j.lift,
      sx: j.sx,
      sy: j.sy,
      eyes: sec >= RISEN ? 'happy' : 'dot',
      gaze: walking ? [-room.side, 0] : room.look(out, 0, spot.z, look.size, room.x(pit.out, pit.z), room.y, pit.z),
      facing: walking || digging ? 'side' : undefined,
    });
    if (digging && stroke < 0.5) {
      for (let n = 0; n < 3; n++) {
        const a = -Math.PI * (0.3 + 0.4 * noise(k, n, Math.floor((sec - ARRIVED) / SHOVEL)));
        const r = 10 + 30 * stroke;
        const x = room.x(pit.out, pit.z) + Math.cos(a) * r;
        const y = room.y + Math.sin(a) * r + 40 * stroke * stroke;
        pen.faded(1 - stroke * 2, () => pen.rect(x, y, 3, 3, pit.z, pal.ink));
      }
    }
  });
  room.a07();
}
