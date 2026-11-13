import type { Part } from '../part.ts';

// A bow in the other ink, on the corner it looks toward.
export const bow: Part = {
  slot: 'hat',
  label: 'Bow',
  front: [
    { poly: [[[0.78, 0], -0.06], [[0.78, -0.17], -0.17], [[0.78, -0.17], 0.05]], fill: 'back', follow: true },
    { poly: [[[0.78, 0], -0.06], [[0.78, 0.17], -0.17], [[0.78, 0.17], 0.05]], fill: 'back', follow: true },
    { rect: [[0.78, -0.045], -0.105, 0.09, 0.09], fill: 'back', follow: true },
  ],
};
