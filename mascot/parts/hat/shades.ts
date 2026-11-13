import type { Part } from '../part.ts';

// Sunglasses pushed up on its head.
export const shades: Part = {
  slot: 'hat',
  label: 'Shades',
  front: [
    { rect: [[0.5, -0.33], -0.13, 0.28, 0.16], fill: 'dark', stroke: 'wear', width: 0.04 },
    { rect: [[0.5, 0.05], -0.13, 0.28, 0.16], fill: 'dark', stroke: 'wear', width: 0.04 },
    { rect: [[0.5, -0.05], -0.09, 0.1, 0.04], fill: 'wear' },
  ],
};
