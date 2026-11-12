// CH. 03, the basement, beside the Linux section. A-07 gets a machine of its
// own: a hard hat drops onto its head (safety first), it types
// `apt install fun` at its own terminal, the install runs, and the
// terminal bursts into confetti. It hangs the hat on the desk on its way out.

import { noise } from '../../../seed';
import { arch, easeIn, phase, span } from '../../../species/motion';
import type { Story } from '../../../world/frame';
import { A07 } from '../../a07/look';
import { at, hop, play, walk, type Spot, type Step } from '../../a07/pose';
import { drawTerminal } from '../../props';
import type { Room } from '../../room';

const DESK = { w: 84, h: 20, d: 40, z: 214 };
const SCREEN = { w: 72, h: 50 };
const COMMAND = '$ apt install fun';

const WALKED = 1.2;
const HAT_ON = 1.9;
const SETTLED = 2.3;
const TYPE = 2.7;
const TYPED = 4.7;
const DONE = 5.9;
const CHEERED = 6.6;
const HAT_OFF = 7.2;

const spotFor = (o: number): Spot => ({ out: o + DESK.w + 18, z: 180 });

/** Typing: a quick bounce, as A-01 types beside the Linux section. */
const typingBounce = (sec: number) => (Math.floor(sec * 11) % 2 ? 1.05 : 0.96);

function steps(room: Room): Step[] {
  const o = room.fit(DESK.w + 36);
  const spot = spotFor(o);
  const screen = [-room.side * 0.9, -0.4] as const;
  return [
    [0, WALKED, (k) => walk(room.hatch, spot, k)],
    [WALKED, HAT_ON, () => at(spot, { gaze: [0, -1], eyes: 'wide' })],
    [HAT_ON, SETTLED, (k) => at(spot, { sx: 1 + 0.2 * arch(k), sy: 1 - 0.2 * arch(k), eyes: k < 0.5 ? 'shut' : 'happy', kit: { hat: true } })],
    [SETTLED, TYPE, () => at(spot, { gaze: screen, kit: { hat: true } })],
    [TYPE, TYPED, (k) => at(spot, { gaze: screen, sy: typingBounce(k * 4), sx: 2 - typingBounce(k * 4), kit: { hat: true } })],
    [TYPED, DONE, () => at(spot, { gaze: screen, kit: { hat: true } })],
    [DONE, CHEERED, (k) => hop(spot, spot, k, 28, { eyes: 'happy', kit: { hat: true } })],
    [CHEERED, HAT_OFF, (k) => at(spot, { gaze: screen, kit: { hat: k < 0.5 } })],
  ];
}

export const story: Story = {
  rests: [
    [0.15, SETTLED],
    [0.4, CHEERED],
    [0.62, HAT_OFF],
  ],
  leave: 0.86,
  pose: (sec, room) => play(steps(room), sec),
};

/** The terminal's lines at sec. */
function lines(room: Room) {
  const { sec, t, pen } = room;
  const { pal } = pen;
  const out: { text: string; color?: string }[] = [];
  if (sec < TYPE) return [{ text: '$ ', color: pal.accent }];
  out.push({ text: COMMAND.slice(0, Math.max(2, Math.ceil(span(sec, TYPE, TYPED - 0.2) * COMMAND.length))) });
  if (sec >= TYPED) {
    const dots = '.'.repeat(1 + (Math.floor(t * 3) % 3));
    out.push({ text: sec < DONE ? `Setting up fun${dots}` : 'Setting up fun...', color: pal.artDim });
  }
  if (sec >= DONE) out.push({ text: '✓ fun installed', color: pal.accent });
  if (sec >= CHEERED) out.push({ text: '$ ', color: pal.accent });
  return out;
}

export function stage(room: Room) {
  const { pen, sec, t } = room;
  const { pal } = pen;
  const o = room.fit(DESK.w + 36);
  const spot = spotFor(o);

  const desk = room.box(o, 0, DESK.z, DESK.w, DESK.h, DESK.d, { front: pal.panel2, top: pal.panel, side: pal.panel2, stroke: pal.ink });
  const sx = desk.x + (DESK.w - SCREEN.w) / 2;
  const sy = desk.y - SCREEN.h - 7;
  const typing = sec < TYPED || sec >= CHEERED;
  drawTerminal(pen, sx, sy, DESK.z + 6, SCREEN.w, SCREEN.h, lines(room), typing && phase(t, 1) < 0.55);

  // The hat, once it is off, sits on the desk's front corner.
  if (sec >= HAT_OFF - 0.3) {
    const x = room.side > 0 ? desk.x + DESK.w - 24 : desk.x + 4;
    pen.rect(x + 2, desk.y - 7, 18, 7, DESK.z + 2, pal.accent);
    pen.rect(x - 1, desk.y - 2, 24, 2, DESK.z + 2, pal.accent);
  }

  room.a07();

  // The hat on its way down, before it lands on A-07.
  if (sec >= WALKED && sec < HAT_ON) {
    const S = A07.size;
    const x = room.x(spot.out, spot.z);
    const head = room.y - S * 1.12;
    const y = head - 260 * (1 - easeIn(span(sec, WALKED, HAT_ON)));
    pen.rect(x - S * 0.45, y - S * 0.27, S * 0.9, S * 0.28, spot.z, pal.accent);
    pen.rect(x - S * 0.6, y - S * 0.04, S * 1.2, S * 0.08, spot.z, pal.accent);
  }

  // Confetti out of the terminal when the install is done.
  const burst = span(sec, DONE, DONE + 1.1);
  if (burst > 0 && burst < 1) {
    const cx = sx + SCREEN.w / 2;
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI * (0.15 + 0.7 * noise(i, 3, 9));
      const v = 60 + 70 * noise(i, 5, 2);
      const x = cx + Math.cos(a) * v * burst;
      const y = sy + Math.sin(a) * v * burst + 120 * burst * burst;
      pen.faded(1 - burst, () => pen.rect(x, y, 4, 4, DESK.z, i % 3 ? (i % 2 ? pal.red : pal.accent) : pal.fg));
    }
  }
}
