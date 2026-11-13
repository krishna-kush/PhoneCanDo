import type { Part } from '../part.ts';

// A gold ring floating over its head.
export const halo: Part = {
  slot: 'hat',
  label: 'Halo',
  front: [{ arc: [[0.5, 0], -0.24, 0.3, 0.08, 0, 360], stroke: 'amber', width: 0.07 }],
};
