import type { Part } from '../part.ts';

// A sweatband round its brow, its knot's tails out behind.
export const headband: Part = {
  slot: 'hat',
  label: 'Headband',
  front: [
    { rect: [-0.04, 0.05, [1, 0.08], 0.1], fill: 'wear' },
    { poly: [[[1, 0.02], 0.07], [[1, 0.26], -0.04], [[1, 0.22], 0.1]], fill: 'wear', follow: true },
    { poly: [[[1, 0.02], 0.11], [[1, 0.2], 0.24], [[1, 0.1], 0.26]], fill: 'wear', follow: true },
  ],
};
