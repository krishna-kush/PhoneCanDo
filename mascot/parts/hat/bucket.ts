import type { Part } from '../part.ts';

// A bucket hat: a short crown with a band, and a brim all round that droops.
export const bucket: Part = {
  slot: 'hat',
  label: 'Bucket hat',
  front: [
    { poly: [[[0.5, -0.24], -0.3], [[0.5, 0.24], -0.3], [[0.5, 0.32], -0.08], [[0.5, -0.32], -0.08]], fill: 'wear' },
    { rect: [[0.5, -0.3], -0.15, 0.6, 0.04], fill: 'dark' },
    { poly: [[[0.5, -0.32], -0.1], [[0.5, 0.32], -0.1], [[0.5, 0.46], 0.02], [[0.5, -0.46], 0.02]], fill: 'wear' },
  ],
};
