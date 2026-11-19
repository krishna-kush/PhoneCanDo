import type { Part } from '../part.ts';

// A bow in the other ink, on the corner it looks toward; side on, seen
// edge on: its near loop swept back, its far one a stub ahead of the knot.
export const bow: Part = {
  slot: 'hat',
  label: 'Bow',
  front: [
    { poly: [[[0.78, 0], -0.06], [[0.78, -0.17], -0.17], [[0.78, -0.17], 0.05]], fill: 'back', follow: true },
    { poly: [[[0.78, 0], -0.06], [[0.78, 0.17], -0.17], [[0.78, 0.17], 0.05]], fill: 'back', follow: true },
    { rect: [[0.78, -0.045], -0.105, 0.09, 0.09], fill: 'back', follow: true },
  ],
  side: [
    { poly: [[[0.62, 0], -0.06], [[0.62, -0.15], -0.18], [[0.62, -0.15], 0.05]], fill: 'back' },
    { poly: [[[0.62, 0], -0.06], [[0.62, 0.08], -0.13], [[0.62, 0.08], 0.01]], fill: 'back' },
    { rect: [[0.62, -0.035], -0.105, 0.07, 0.09], fill: 'back' },
  ],
};
