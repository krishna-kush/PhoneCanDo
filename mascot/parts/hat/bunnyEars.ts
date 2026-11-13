import type { Part } from '../part.ts';

// Two tall ears in its own ink, the other ink inside.
export const bunnyEars: Part = {
  slot: 'hat',
  label: 'Bunny ears',
  front: [
    { rect: [[0.5, -0.27], -0.54, 0.14, 0.56], fill: 'front' },
    { rect: [[0.5, -0.23], -0.47, 0.06, 0.4], fill: 'back' },
    { rect: [[0.5, 0.13], -0.5, 0.14, 0.52], fill: 'front' },
    { rect: [[0.5, 0.17], -0.43, 0.06, 0.36], fill: 'back' },
  ],
};
