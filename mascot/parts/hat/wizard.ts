import type { Part } from '../part.ts';

// A tall cone, its tip bent the way it looks, a red star on it and a brim.
export const wizard: Part = {
  slot: 'hat',
  label: 'Wizard hat',
  front: [
    {
      poly: [
        [[0.5, -0.3], -0.05],
        [[0.5, 0.3], -0.05],
        [[0.5, 0.12], -0.5],
        [[0.5, 0.32], -0.74],
        [[0.5, 0.02], -0.54],
      ],
      fill: 'wear',
      follow: true,
    },
    { rect: [[0.5, -0.08], -0.3, 0.1, 0.1], fill: 'red' },
    { rect: [[0.5, -0.44], -0.09, 0.88, 0.08], fill: 'wear' },
  ],
};
