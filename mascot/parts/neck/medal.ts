import { circle, type Part } from '../part.ts';

// A medal on a ribbon, in the other ink.
export const medal: Part = {
  slot: 'neck',
  label: 'Medal',
  front: [
    { line: [[[0.5, -0.15], 0.6], [[0.5, 0], 0.82]], stroke: 'dark', width: 0.05 },
    { line: [[[0.5, 0.15], 0.6], [[0.5, 0], 0.82]], stroke: 'dark', width: 0.05 },
    circle([0.5, 0], 0.87, 0.09, { fill: 'back' }),
  ],
  side: [circle([1, -0.06], 0.84, 0.08, { fill: 'back' })],
};
