// CH. 09, the night shift, beside the footer: the end of the story. Under
// the moon, at a desk lit by a lamp, A-07 starts a job and keeps it running,
// as an agent can be asked to stay up. It yawns, lies down by the desk and
// falls asleep while the terminal goes on printing.

import { arch, phase, span } from '../../../species/motion';
import type { Story } from '../../../world/frame';
import { A07 } from '../../a07/look';
import { at, play, walk, type Spot, type Step } from '../../a07/pose';
import { drawMug, drawTerminal } from '../../props';
import type { Room } from '../../room';

const DESK = { w: 84, h: 20, d: 40, z: 214 };
const SCREEN = { w: 72, h: 50 };
const COMMAND = '$ keep running';

const AT_DESK = 1.2;
const STARTED = 3.4;
const YAWNED = 4.3;
const ASLEEP = 5.2;

const spotFor = (o: number): Spot => ({ out: o + DESK.w + 18, z: 180 });

function steps(room: Room): Step[] {
  const o = room.fit(DESK.w + 36);
  const spot = spotFor(o);
  const screen = [-room.side * 0.9, -0.4] as const;
  const typing = (k: number) => (Math.floor(k * 30) % 2 ? 1.05 : 0.96);
  return [
    [0, AT_DESK, (k) => walk(room.hatch, spot, k)],
    [AT_DESK, STARTED, (k) => at(spot, { gaze: screen, sy: k < 0.7 ? typing(k) : 1, sx: k < 0.7 ? 2 - typing(k) : 1 })],
    // A yawn, a stretch.
    [STARTED, YAWNED, (k) => at(spot, { eyes: 'sleepy', sy: 1 + 0.12 * arch(k), sx: 1 - 0.08 * arch(k) })],
    // Down by the desk, out like a light.
    [YAWNED, ASLEEP, (k) => at(spot, { shape: k > 0.4 ? 'wide' : 'square', eyes: 'shut', sy: 1 - 0.1 * span(k, 0.4, 1) })],
  ];
}

export const story: Story = {
  rests: [
    [0.12, STARTED],
    [0.3, ASLEEP],
  ],
  leave: 1,
  pose: (sec, room) => {
    const pose = play(steps(room), sec);
    // Asleep, it breathes slowly.
    return sec >= ASLEEP ? { ...pose, sy: 0.9 + 0.05 * Math.sin(room.t * 1.3), sx: 1 } : pose;
  },
};

/** The terminal's lines: the job started, then a line now and then all night. */
function lines(room: Room) {
  const { sec, t, pen } = room;
  const { pal } = pen;
  if (sec < AT_DESK) return [{ text: '$ ', color: pal.accent }];
  const out: { text: string; color?: string }[] = [
    { text: COMMAND.slice(0, Math.max(2, Math.ceil(span(sec, AT_DESK, AT_DESK + 1.4) * COMMAND.length))) },
  ];
  if (sec < AT_DESK + 1.6) return out;
  out.push({ text: '✓ job running', color: pal.accent });
  const ticks = Math.floor(t / 2.5);
  for (let k = Math.max(0, ticks - 1); k <= ticks; k++) out.push({ text: `· still on it ${k % 2 ? '·' : ''}`, color: pal.artDim });
  return out;
}

export function stage(room: Room) {
  const { pen, sec, t } = room;
  const { pal } = pen;
  const ctx = pen.ctx;
  const o = room.fit(DESK.w + 36);
  const spot = spotFor(o);

  const desk = room.box(o, 0, DESK.z, DESK.w, DESK.h, DESK.d, { front: pal.panel2, top: pal.panel, side: pal.panel2, stroke: pal.ink });
  const sx = desk.x + (DESK.w - SCREEN.w) / 2;
  const sy = desk.y - SCREEN.h - 7;

  // The lamp's glow over the desk, behind everything on it.
  const glow = pen.at(sx + SCREEN.w / 2, sy + 10, DESK.z);
  const r = 120 * glow.s;
  const g = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, r);
  g.addColorStop(0, pal.accent);
  g.addColorStop(1, 'transparent');
  ctx.globalAlpha = (pal.light ? 0.12 : 0.16) * (0.9 + 0.1 * Math.sin(t * 2));
  ctx.fillStyle = g;
  ctx.fillRect(glow.x - r, glow.y - r, r * 2, r * 2);

  drawTerminal(pen, sx, sy, DESK.z + 6, SCREEN.w, SCREEN.h, lines(room), phase(t, 1) < 0.55);
  const mugX = room.side > 0 ? desk.x + 4 : desk.x + DESK.w - 16;
  drawMug(pen, mugX, desk.y - 14, DESK.z + 2, 12, t, sec < ASLEEP);

  room.a07();

  // Asleep: z's drifting up off it.
  if (sec < ASLEEP) return;
  const x = room.x(spot.out + 12, spot.z);
  for (let n = 0; n < 3; n++) {
    const q = phase(t, 3, n);
    pen.faded(arch(q), () =>
      pen.text('z', x + q * 14 * room.side, room.y - A07.size - q * 44, spot.z, { px: 8 + q * 6, color: pal.muted, weight: 600 }),
    );
  }
}
