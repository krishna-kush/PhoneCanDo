// The night shift's cast, in the left margin: the crew asleep on the floor,
// lying flat (the wide pose), breathing slowly, z's drifting off them.

import { cousin } from '../../../species/look';
import { arch, phase } from '../../../species/motion';
import type { Room } from '../../room';

const SLEEPERS = [
  cousin('night:1', { size: 26, gear: 'antenna', pose: 'wide', swap: true }),
  cousin('night:2', { size: 22, gear: 'none', pose: 'wide' }),
  cousin('night:3', { size: 24, gear: 'cap', pose: 'wide' }),
];

export function cast(room: Room) {
  const { pen, t } = room;
  const { pal } = pen;
  const o = room.fit(150);
  const spots = [
    { out: o + 60, z: 290 },
    { out: o + 120, z: 210 },
    { out: o + 20, z: 150 },
  ];
  spots.forEach((s, k) => {
    const breath = Math.sin(t * 1.2 + k * 2) * 0.05;
    const body = room.unit(`night:${k + 1}`, SLEEPERS[k], { out: s.out, z: s.z, eyes: 'shut', sy: 0.9 + breath, sx: 1 - breath * 0.5 });
    for (let n = 0; n < 2; n++) {
      const q = phase(t, 3.4, k * 1.1 + n * 1.7);
      pen.faded(arch(q), () =>
        pen.text('z', body.x + q * 12 * -room.side, body.top - 4 - q * 40, s.z, { px: 7 + q * 6, color: pal.muted, weight: 600 }),
      );
    }
  });
}
