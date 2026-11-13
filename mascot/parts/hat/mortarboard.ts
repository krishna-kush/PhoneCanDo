import type { Part } from '../part.ts';

// A graduate's cap: a flat board on a cap, its red tassel hanging the way it looks.
export const mortarboard: Part = {
  slot: 'hat',
  label: 'Mortarboard',
  front: [
    { rect: [[0.5, -0.24], -0.16, 0.48, 0.17], fill: 'wear' },
    { poly: [[[0.5, -0.5], -0.2], [[0.5, 0], -0.3], [[0.5, 0.5], -0.2], [[0.5, 0], -0.1]], fill: 'wear' },
    { line: [[[0.5, 0], -0.2], [[0.5, 0.42], -0.18]], stroke: 'red', width: 0.04, follow: true },
    { line: [[[0.5, 0.42], -0.18], [[0.5, 0.44], 0.02]], stroke: 'red', width: 0.04, follow: true },
    { rect: [[0.5, 0.4], 0, 0.08, 0.1], fill: 'red', follow: true },
  ],
};
