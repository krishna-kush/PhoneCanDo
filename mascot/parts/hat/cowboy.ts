import type { Part } from '../part.ts';

// A dented crown with a red band, on a brim turned up at its ends.
export const cowboy: Part = {
  slot: 'hat',
  label: 'Cowboy hat',
  front: [
    {
      poly: [[[0.5, -0.26], -0.06], [[0.5, -0.22], -0.4], [[0.5, 0], -0.32], [[0.5, 0.22], -0.4], [[0.5, 0.26], -0.06]],
      fill: 'wear',
    },
    { rect: [[0.5, -0.25], -0.16, 0.5, 0.06], fill: 'red' },
    {
      poly: [
        [[0, -0.32], -0.2],
        [[0, -0.16], -0.08],
        [[1, 0.16], -0.08],
        [[1, 0.32], -0.2],
        [[1, 0.32], -0.12],
        [[1, 0.16], 0],
        [[0, -0.16], 0],
        [[0, -0.32], -0.12],
      ],
      fill: 'wear',
    },
  ],
};
