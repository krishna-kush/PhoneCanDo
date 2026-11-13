import type { Part } from '../part.ts';

// Two little horns, grown in its own ink.
export const horns: Part = {
  slot: 'hat',
  label: 'Horns',
  front: [
    { poly: [[[0.1, 0], 0.02], [[0.1, 0.2], 0.02], [[0.1, -0.04], -0.28]], fill: 'front' },
    { poly: [[[0.9, 0], 0.02], [[0.9, -0.2], 0.02], [[0.9, 0.04], -0.28]], fill: 'front' },
  ],
};
