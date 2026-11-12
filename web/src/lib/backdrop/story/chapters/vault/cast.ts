// The vault's cast, in the left margin: cousins drained grey behind a gate
// that stays locked, as A-01 is at the gate until you arm it. One rattles
// the bars now and then; they all watch you, the one who can open it.

import { cousin } from '../../../species/look';
import { arch, phase, span } from '../../../species/motion';
import type { Room } from '../../room';
import { drawBars } from './gate';

const KEPT = [
  cousin('vault:kept1', { size: 24, gear: 'antenna', pose: 'square' }),
  cousin('vault:kept2', { size: 20, gear: 'cap', pose: 'wide', swap: true }),
  cousin('vault:kept3', { size: 26, gear: 'none', pose: 'tall' }),
];
const GATE = { w: 110, h: 70, z: 230 };

export function cast(room: Room) {
  const { t } = room;
  const o = room.fit(GATE.w);
  // Furthest first: each stands a little further back than the one before.
  [...KEPT.entries()].reverse().forEach(([k, look]) => {
    const out = o + 20 + k * 34;
    const rattle = k === 0 ? span(phase(t, 4.5), 0.1, 0.35) : 0;
    room.unit(`vault:kept${k + 1}`, look, {
      out: out + Math.sin(rattle * 40) * 2 * arch(rattle),
      z: GATE.z + 30 + (k === 0 ? -20 * arch(rattle) : k * 14),
      grey: true,
      eyes: k === 1 ? 'sleepy' : rattle > 0 ? 'shut' : 'dot',
    });
  });
  drawBars(room, o, GATE.z, GATE.w, GATE.h, 0, false);
}
