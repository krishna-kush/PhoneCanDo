// CH. 02, the lineup, beside the agents and models. A-07 joins the crew: it
// stands at the height chart and the bar comes down to measure it. Then a
// brain cartridge is lowered on a cable and slides into its head, where the
// cloud cord was plugged; its eyes go wide, an antenna goes up, and it hops.
// From here down it thinks on the phone.

import { arch, easeIn, easeOut, span } from '../../../species/motion';
import type { Story } from '../../../world/frame';
import { A07 } from '../../a07/look';
import { at, hop, play, walk, type Spot, type Step } from '../../a07/pose';
import type { Room } from '../../room';

const CHART = { w: 70, h: 86, z: 236 };
const CART = { w: 22, h: 14, d: 8 };

const WALKED = 1.3;
const MEASURED = 2.5;
const NOTED = 2.9;
const LOWERED = 4.2;
const IN = 4.8;
const LIT = 5.4;
const HOPPED = 6.1;

const spotFor = (o: number): Spot => ({ out: o + CHART.w / 2, z: 204 });

function steps(room: Room): Step[] {
  const o = room.fit(CHART.w + 20);
  const spot = spotFor(o);
  return [
    [0, WALKED, (k) => walk(room.hatch, spot, k)],
    // Stands tall to be measured, eyes up at the bar.
    [WALKED, NOTED, (k) => at(spot, { sy: 1.05, gaze: [0, -1], eyes: k > 0.8 ? 'happy' : 'dot' })],
    [NOTED, LOWERED, () => at(spot, { gaze: [0, -1], eyes: 'wide' })],
    // The cartridge goes in.
    [LOWERED, IN, (k) => at(spot, { sx: 1 + 0.08 * arch(k), sy: 1 - 0.1 * arch(k), gaze: [0, -1], eyes: 'shut' })],
    [IN, LIT, () => at(spot, { eyes: 'wide', kit: { brain: true } })],
    [LIT, HOPPED, (k) => hop(spot, spot, k, 30, { eyes: 'happy', kit: { brain: true } })],
  ];
}

export const story: Story = {
  rests: [
    [0.15, NOTED],
    [0.42, HOPPED],
  ],
  leave: 0.85,
  pose: (sec, room) => play(steps(room), sec),
  after: { brain: true },
};

export function stage(room: Room) {
  const { pen, sec } = room;
  const { pal } = pen;
  const o = room.fit(CHART.w + 20);
  const spot = spotFor(o);

  // The height chart: rules every 13 units, numbered on its outer side.
  const chart = room.panel(o, 0, CHART.z, CHART.w, CHART.h, pal.panel, pal.line2);
  for (let k = 1; k * 13 < CHART.h; k++) {
    const y = room.y - k * 13;
    pen.line([chart.x, y, CHART.z], [chart.x + CHART.w, y, CHART.z], pal.line2);
    const numX = room.side > 0 ? chart.x + CHART.w - 3 : chart.x + 3;
    pen.text(String(k * 13), numX, y - 2, CHART.z, { px: 6, color: pal.faint, align: room.side > 0 ? 'right' : 'left' });
  }

  room.a07();
  drawSparks(room, spot);

  // The measuring bar slides down the chart to its head.
  const head = room.y - (A07.size + A07.size * 0.12) * 1.05;
  const down = easeOut(span(sec, WALKED, MEASURED));
  const barY = room.y - CHART.h + 4 + (head - (room.y - CHART.h + 4)) * down;
  if (sec < IN + 1) {
    pen.faded(1 - span(sec, IN, IN + 1), () => {
      pen.rect(chart.x - 4, barY - 2, CHART.w + 8, 3, CHART.z - 30, pal.red);
      pen.faded(span(sec, MEASURED, NOTED), () =>
        pen.text(`A-07 · ${A07.size}`, room.x(spot.out + 28, CHART.z - 30), barY - 5, CHART.z - 30, {
          px: 7,
          color: pal.red,
          align: room.side > 0 ? 'left' : 'right',
          track: 0.1,
          weight: 600,
        }),
      );
    });
  }

  // The brain cartridge, lowered on a cable from out of sight, into its head.
  if (sec >= IN) return;
  const z = spot.z - 4;
  const x = room.x(spot.out, z) - CART.w / 2;
  const rest = head - CART.h - 6;
  const from = rest - 320;
  const low = easeOut(span(sec, NOTED, LOWERED));
  const sink = easeIn(span(sec, LOWERED, IN));
  const y = from + (rest - from) * low + (CART.h + 6) * sink;
  const shown = Math.max(0, Math.min(CART.h, head - y));
  pen.line([x + CART.w / 2, y - 400, z], [x + CART.w / 2, y, z], pal.ink, 1, [4, 3]);
  if (shown <= 0) return;
  pen.box(x, y, z, CART.w, shown, CART.d, { front: pal.accent, top: pal.accent, side: pal.ink, stroke: pal.ink });
  if (shown > CART.h * 0.6) {
    pen.text('GGUF', x + CART.w / 2, y + CART.h * 0.55, z, { px: 5.5, color: pal.artBg, align: 'center', base: 'middle', weight: 600 });
  }
}

/** The sparks round its head as the brain comes on. */
function drawSparks(room: Room, spot: Spot) {
  const { pen, sec } = room;
  const k = span(sec, IN, LIT);
  if (k <= 0 || k >= 1 || !room.actor) return;
  const x = room.x(spot.out, spot.z);
  const y = room.y - A07.size * 1.4;
  pen.faded(1 - k, () => {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const r = 14 + 22 * k;
      pen.line(
        [x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, spot.z],
        [x + Math.cos(a) * r, y + Math.sin(a) * r, spot.z],
        i % 2 ? pen.pal.red : pen.pal.accent,
        1.5,
      );
    }
  });
}
