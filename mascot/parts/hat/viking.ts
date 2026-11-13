import type { Part } from '../part.ts';

// A helmet's dome with a rim, and two amber horns curling up.
export const viking: Part = {
  slot: 'hat',
  label: 'Viking helmet',
  front: [
    {
      poly: [[[0.1, 0], -0.06], [[0.1, -0.16], -0.16], [[0.1, -0.22], -0.42], [[0.1, -0.04], -0.22], [[0.1, 0.06], -0.12]],
      fill: 'amber',
    },
    {
      poly: [[[0.9, 0], -0.06], [[0.9, 0.16], -0.16], [[0.9, 0.22], -0.42], [[0.9, 0.04], -0.22], [[0.9, -0.06], -0.12]],
      fill: 'amber',
    },
    { arc: [[0.5, 0], 0.02, [0.42, 0], 0.3, 180, 360], fill: 'wear' },
    { rect: [[0.06, 0], -0.05, [0.88, 0], 0.07], fill: 'dark' },
  ],
};
