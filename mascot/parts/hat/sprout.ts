import type { Part } from '../part.ts';

// A stalk with two amber leaves.
export const sprout: Part = {
  slot: 'hat',
  label: 'Sprout',
  front: [
    { line: [[[0.5, 0], 0.01], [[0.5, 0], -0.24]], stroke: 'wear', width: 0.05 },
    { poly: [[[0.5, 0], -0.18], [[0.5, -0.12], -0.3], [[0.5, -0.3], -0.28], [[0.5, -0.16], -0.18]], fill: 'amber' },
    { poly: [[[0.5, 0], -0.23], [[0.5, 0.1], -0.37], [[0.5, 0.3], -0.4], [[0.5, 0.17], -0.25]], fill: 'amber' },
  ],
};
