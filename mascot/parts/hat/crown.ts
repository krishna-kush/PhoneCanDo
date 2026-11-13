import type { Part } from '../part.ts';

// A gold crown of three points, a red jewel in the middle.
export const crown: Part = {
  slot: 'hat',
  label: 'Crown',
  front: [
    {
      poly: [
        [[0.5, -0.3], 0.02],
        [[0.5, -0.3], -0.26],
        [[0.5, -0.15], -0.12],
        [[0.5, 0], -0.32],
        [[0.5, 0.15], -0.12],
        [[0.5, 0.3], -0.26],
        [[0.5, 0.3], 0.02],
      ],
      fill: 'amber',
    },
    { rect: [[0.5, -0.04], -0.1, 0.08, 0.08], fill: 'red' },
  ],
};
