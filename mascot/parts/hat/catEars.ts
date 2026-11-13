import type { Part } from '../part.ts';

// Pointed ears in its own ink, the other ink inside.
export const catEars: Part = {
  slot: 'hat',
  label: 'Cat ears',
  front: [
    { poly: [[0, 0.02], [[0, 0.36], 0.02], [[0, 0.06], -0.3]], fill: 'front' },
    { poly: [[[0, 0.1], 0.01], [[0, 0.26], 0.01], [[0, 0.1], -0.16]], fill: 'back' },
    { poly: [[[1, 0], 0.02], [[1, -0.36], 0.02], [[1, -0.06], -0.3]], fill: 'front' },
    { poly: [[[1, -0.1], 0.01], [[1, -0.26], 0.01], [[1, -0.1], -0.16]], fill: 'back' },
  ],
};
