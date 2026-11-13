import type { Mark, Part } from '../part.ts';

const LENS: Mark = { rect: [[0, -0.06], [0, -0.06], [1, 0.12], [1, 0.12]], stroke: 'dark', width: 0.05, eye: 'each' };

// A frame round each eye and a bridge between; side on, one lens and its arm.
export const glasses: Part = {
  slot: 'face',
  label: 'Glasses',
  front: [LENS, { rect: [[0.5, -0.07], 0.39, 0.14, 0.05], fill: 'dark' }],
  side: [LENS, { line: [[[1, -0.385], 0.41], [[0.3, 0], 0.41]], stroke: 'dark', width: 0.05 }],
};
