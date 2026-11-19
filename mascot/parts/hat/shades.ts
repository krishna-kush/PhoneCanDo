import type { Part } from '../part.ts';

// Sunglasses pushed up on its head. Side on, one lens at its brow, its arm
// running back over its head.
export const shades: Part = {
  slot: 'hat',
  label: 'Shades',
  front: [
    { rect: [[0.5, -0.33], -0.13, 0.28, 0.16], fill: 'dark', stroke: 'wear', width: 0.04 },
    { rect: [[0.5, 0.05], -0.13, 0.28, 0.16], fill: 'dark', stroke: 'wear', width: 0.04 },
    { rect: [[0.5, -0.05], -0.09, 0.1, 0.04], fill: 'wear' },
  ],
  side: [
    { rect: [[0.2, 0], -0.09, [0.8, -0.3], 0.04], fill: 'wear' },
    { rect: [[1, -0.3], -0.13, 0.12, 0.16], fill: 'dark', stroke: 'wear', width: 0.04 },
  ],
};
