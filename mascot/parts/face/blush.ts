import type { Part } from '../part.ts';

// A blush on each cheek, under the outer half of each eye, in the other ink.
export const blush: Part = {
  slot: 'face',
  label: 'Blush',
  front: [
    { rect: [[0.5, -0.31], 0.63, 0.12, 0.06], fill: 'back' },
    { rect: [[0.5, 0.19], 0.63, 0.12, 0.06], fill: 'back' },
  ],
  side: [{ rect: [[1, -0.3], 0.63, 0.12, 0.06], fill: 'back' }],
};
