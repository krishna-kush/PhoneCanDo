import type { Mark, Part } from '../part.ts';

const BAND: Mark = { rect: [-0.04, 0.05, [1, 0.08], 0.1], fill: 'wear' };

// A sweatband round its brow, its knot's tails out behind; side on, they
// trail off the back of its head.
export const headband: Part = {
  slot: 'hat',
  label: 'Headband',
  front: [
    BAND,
    { poly: [[[1, 0.02], 0.07], [[1, 0.26], -0.04], [[1, 0.22], 0.1]], fill: 'wear', follow: true },
    { poly: [[[1, 0.02], 0.11], [[1, 0.2], 0.24], [[1, 0.1], 0.26]], fill: 'wear', follow: true },
  ],
  side: [
    BAND,
    { poly: [[-0.02, 0.07], [-0.26, -0.04], [-0.22, 0.1]], fill: 'wear' },
    { poly: [[-0.02, 0.11], [-0.2, 0.24], [-0.1, 0.26]], fill: 'wear' },
  ],
};
