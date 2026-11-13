import { circle, type Part } from '../part.ts';

// A red hat flopped over the way it looks, its white band and pompom.
export const santa: Part = {
  slot: 'hat',
  label: 'Santa hat',
  front: [
    { poly: [[[0.06, 0], 0], [[0.94, 0], 0], [[0.7, 0], -0.26], [[1, 0.04], -0.12], [[0.5, 0], -0.42]], fill: 'red', follow: true },
    { rect: [-0.04, -0.07, [1, 0.08], 0.11], fill: 'wear' },
    circle([1, 0.04], -0.1, 0.08, { fill: 'wear', follow: true }),
  ],
};
