import type { Part } from '../part.ts';

// A patch over one eye, its strap across the block.
export const eyepatch: Part = {
  slot: 'face',
  label: 'Eyepatch',
  front: [
    { line: [[0, 0.1], [[1, 0], 0.3]], stroke: 'dark', width: 0.04 },
    { rect: [[0, -0.06], [0, -0.05], [1, 0.12], [1, 0.1]], fill: 'dark', eye: 'one' },
  ],
};
