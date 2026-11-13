import type { Part } from '../part.ts';
import { cans } from './headphones.ts';

const { front, side } = cans(0.12);

// Headphones with a mic out to its mouth.
export const headset: Part = {
  slot: 'hat',
  label: 'Headset',
  front: [...front, { line: [[[1, 0.04], 0.42], [[1, -0.2], 0.74]], stroke: 'wear', width: 0.06 }],
  side: [...side, { line: [[[0.5, 0], 0.42], [[0.5, 0.24], 0.74]], stroke: 'wear', width: 0.06 }],
  back: front,
};
