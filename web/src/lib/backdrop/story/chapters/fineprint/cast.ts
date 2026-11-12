// The fine print's cast, in the left margin: three cousins with questions
// rising off them on a loop; now and then the middle one gets its answer,
// a red "!", and hops.

import { cousin } from '../../../species/look';
import { arch, jump, phase, span } from '../../../species/motion';
import type { Room } from '../../room';

const ASKERS = [
  cousin('fineprint:1', { size: 24, gear: 'none', pose: 'square' }),
  cousin('fineprint:2', { size: 22, gear: 'cap', pose: 'square', swap: true }),
  cousin('fineprint:3', { size: 26, gear: 'antenna', pose: 'tall' }),
];
const EVERY = 2.6;

export function cast(room: Room) {
  const { pen, t } = room;
  const { pal } = pen;
  const o = room.fit(130);
  const spots = [
    { out: o + 20, z: 280 },
    { out: o + 80, z: 200 },
    { out: o + 40, z: 130 },
  ];
  spots.forEach((s, k) => {
    const q = phase(t, EVERY, k * 0.9);
    // Every fourth question of the middle one is answered.
    const answered = k === 1 && Math.floor((t + k * 0.9) / EVERY) % 4 === 3;
    const j = answered ? jump(span(q, 0.1, 0.45), 22) : null;
    const body = room.unit(`fineprint:${k + 1}`, ASKERS[k], {
      out: s.out,
      z: s.z,
      lift: j?.lift,
      sx: j?.sx,
      sy: j?.sy,
      eyes: answered && q < 0.6 ? 'happy' : 'dot',
      gaze: answered ? undefined : [Math.sin(t * 0.7 + k) * 0.7, -0.6],
    });
    const top = body.top - (ASKERS[k].gear === 'antenna' ? ASKERS[k].size * 0.45 : 4);
    pen.faded(arch(q), () =>
      pen.text(answered ? '!' : '?', body.x + Math.sin(q * 6 + k) * 5, top - 6 - q * 40, s.z, {
        serif: true,
        px: answered ? 24 : 20,
        color: answered ? pal.red : pal.ink,
        align: 'center',
      }),
    );
  });
}
