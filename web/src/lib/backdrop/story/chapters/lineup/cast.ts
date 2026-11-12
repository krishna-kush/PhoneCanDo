// The lineup's cast, in the left margin: the crew against a long height
// chart, every one a different kind of agent and so a different cousin.
// One at a time steps forward, hops under the marker and steps back.

import { cousin } from '../../../species/look';
import { arch, jump, phase, span } from '../../../species/motion';
import type { Room } from '../../room';

const CREW = [
  cousin('lineup:1', { size: 24, pose: 'square', gear: 'antenna' }),
  cousin('lineup:2', { size: 20, pose: 'wide', gear: 'cap', swap: true }),
  cousin('lineup:3', { size: 22, pose: 'tall', gear: 'glasses' }),
  cousin('lineup:4', { size: 26, pose: 'square', gear: 'bow', swap: true }),
];
const PITCH = 38;
const CHART = { w: CREW.length * PITCH + 10, h: 78, z: 290 };
const TURN = 1.7;

export function cast(room: Room) {
  const { pen, t } = room;
  const { pal } = pen;
  const o = room.fit(CHART.w);
  const chart = room.panel(o, 0, CHART.z, CHART.w, CHART.h, pal.panel, pal.line2);
  for (let k = 1; k * 13 < CHART.h; k++) {
    const y = room.y - k * 13;
    pen.line([chart.x, y, CHART.z], [chart.x + CHART.w, y, CHART.z], pal.line2);
  }
  const p = phase(t, TURN * CREW.length);
  const who = Math.floor(p * CREW.length);
  const q = (p * CREW.length) % 1;
  const step = arch(span(q, 0.05, 0.95));
  const order = CREW.map((look, k) => ({ look, k, z: 256 - (k === who ? 56 * step : 0) })).sort((a, b) => b.z - a.z);
  for (const { look, k, z } of order) {
    const up = k === who;
    const j = up ? jump(span(q, 0.35, 0.62), 18) : { lift: 0, sx: 1, sy: 1 };
    const out = o + 24 + k * PITCH;
    const body = room.unit(`lineup:${k + 1}`, look, {
      out,
      z,
      lift: j.lift,
      sx: up ? j.sx : undefined,
      sy: up ? j.sy : undefined,
      eyes: up && q > 0.3 && q < 0.7 ? 'happy' : 'dot',
    });
    pen.text(look.serial, body.x, room.y - CHART.h - 6, CHART.z, { px: 6.5, color: up ? pal.red : pal.faint, align: 'center', track: 0.1 });
    if (up) {
      const y = body.top - 18 - Math.sin(t * 8) * 2 - (look.gear === 'antenna' ? look.size * 0.45 : 0);
      pen.shape(
        [
          [body.x - 4, y - 5, z],
          [body.x + 4, y - 5, z],
          [body.x, y, z],
        ],
        pal.red,
      );
    }
  }
}
