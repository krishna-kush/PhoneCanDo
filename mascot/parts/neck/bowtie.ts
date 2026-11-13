import type { Part } from '../part.ts';

// Two wings and a knot.
export const bowtie: Part = {
  slot: 'neck',
  label: 'Bow tie',
  front: [
    { poly: [[[0.5, 0], 0.72], [[0.5, -0.24], 0.57], [[0.5, -0.24], 0.87]], fill: 'dark' },
    { poly: [[[0.5, 0], 0.72], [[0.5, 0.24], 0.57], [[0.5, 0.24], 0.87]], fill: 'dark' },
    { rect: [[0.5, -0.0525], 0.66, 0.105, 0.12], fill: 'dark' },
  ],
  side: [{ poly: [[[1, -0.045], 0.72], [[1, 0.18], 0.57], [[1, 0.18], 0.87]], fill: 'dark' }],
};
