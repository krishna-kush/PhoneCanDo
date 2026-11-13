import { circle, type Part } from '../part.ts';

// A chef's toque: a band and three puffs.
export const chef: Part = {
  slot: 'hat',
  label: "Chef's hat",
  front: [
    { rect: [[0.5, -0.26], -0.2, 0.52, 0.22], fill: 'wear' },
    circle([0.5, -0.17], -0.3, 0.15, { fill: 'wear' }),
    circle([0.5, 0.17], -0.3, 0.15, { fill: 'wear' }),
    circle([0.5, 0], -0.38, 0.18, { fill: 'wear' }),
    { line: [[[0.5, -0.24], -0.14], [[0.5, 0.24], -0.14]], stroke: 'dark', width: 0.03 },
  ],
};
