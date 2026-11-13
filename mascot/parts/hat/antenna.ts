import type { Part } from '../part.ts';

// A stalk with a red tip.
export const antenna: Part = {
  slot: 'hat',
  label: 'Antenna',
  front: [
    { line: [[[0.5, 0], 0], [[0.5, 0], -0.32]], stroke: 'wear', width: 0.06 },
    { rect: [[0.5, -0.07], -0.42, 0.14, 0.14], fill: 'red' },
  ],
};
