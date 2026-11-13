import type { Part } from '../part.ts';

// A ring round one eye, on a chain.
export const monocle: Part = {
  slot: 'face',
  label: 'Monocle',
  front: [
    { arc: [[0.5, 0], [0.5, 0], [0.5, 0.07], [0.5, 0.06], 0, 360], stroke: 'dark', width: 0.05, eye: 'one' },
    { line: [[[1, 0.04], [1, 0]], [[1, 0.1], [1, 0.36]]], stroke: 'dark', width: 0.03, eye: 'one' },
  ],
};
