import type { Part } from '../part.ts';

// A soft beret tipped the way it looks, with a stalk.
export const beret: Part = {
  slot: 'hat',
  label: 'Beret',
  front: [
    { arc: [[0.5, 0.06], 0.02, [0.5, 0.06], 0.17, 180, 360], fill: 'wear', follow: true },
    { rect: [[0.5, 0.04], -0.22, 0.04, 0.08], fill: 'wear', follow: true },
  ],
};
