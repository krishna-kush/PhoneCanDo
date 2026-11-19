import type { Part } from '../part.ts';

// Two little horns, grown in its own ink. Side on, the near horn stands
// in front of the far one, which shows behind in the other ink.
export const horns: Part = {
  slot: 'hat',
  label: 'Horns',
  front: [
    { poly: [[[0.1, 0], 0.02], [[0.1, 0.2], 0.02], [[0.1, -0.04], -0.28]], fill: 'front' },
    { poly: [[[0.9, 0], 0.02], [[0.9, -0.2], 0.02], [[0.9, 0.04], -0.28]], fill: 'front' },
  ],
  side: [
    { poly: [[[0.5, -0.24], 0.02], [[0.5, -0.04], 0.02], [[0.5, -0.04], -0.26]], fill: 'back' },
    { poly: [[[0.5, -0.1], 0.02], [[0.5, 0.1], 0.02], [[0.5, 0.12], -0.28]], fill: 'front' },
  ],
};
