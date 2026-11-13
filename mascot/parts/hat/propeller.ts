import type { Part } from '../part.ts';

// A little dome with a stalk and a red propeller on top.
export const propeller: Part = {
  slot: 'hat',
  label: 'Propeller cap',
  front: [
    { arc: [[0.5, 0], 0.02, 0.3, 0.2, 180, 360], fill: 'wear' },
    { line: [[[0.5, 0], -0.16], [[0.5, 0], -0.33]], stroke: 'wear', width: 0.05 },
    { poly: [[[0.5, 0], -0.34], [[0.5, -0.34], -0.42], [[0.5, -0.34], -0.32]], fill: 'red' },
    { poly: [[[0.5, 0], -0.34], [[0.5, 0.34], -0.36], [[0.5, 0.34], -0.26]], fill: 'red' },
  ],
};
