import type { Part } from '../part.ts';

// A staff badge on a lanyard.
export const badge: Part = {
  slot: 'neck',
  label: 'Badge',
  front: [
    { line: [[[0.5, -0.22], 0.58], [[0.5, 0], 0.74]], stroke: 'dark', width: 0.04 },
    { line: [[[0.5, 0.22], 0.58], [[0.5, 0], 0.74]], stroke: 'dark', width: 0.04 },
    { rect: [[0.5, -0.11], 0.72, 0.22, 0.2], fill: 'eye', stroke: 'dark', width: 0.03 },
    { rect: [[0.5, -0.11], 0.72, 0.22, 0.06], fill: 'back' },
  ],
  side: [{ rect: [[1, -0.08], 0.7, 0.06, 0.2], fill: 'eye', stroke: 'dark', width: 0.03 }],
};
