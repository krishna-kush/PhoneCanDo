import type { Part } from '../part.ts';

// A scarf like Little's (A-07), its tail out behind the way it looks.
export const scarf: Part = {
  slot: 'neck',
  label: 'Scarf',
  front: [
    { rect: [-0.05, [0.62, 0], [1, 0.1], 0.15], fill: 'wear' },
    {
      poly: [[[0, 0.12], [0.62, 0.04]], [[0, -0.34], [0.62, 0.14]], [[0, -0.28], [0.62, 0.3]], [[0, 0.16], [0.62, 0.15]]],
      fill: 'wear',
      follow: true,
    },
  ],
};
