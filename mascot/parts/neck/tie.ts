import type { Part, Point } from '../part.ts';

// Its knot under the eyes, its blade down the front to near the bottom.
const BLADE: [number, number][] = [[-0.22, 0], [0.22, 0], [0.12, 0.16], [0.5, 0.82], [0, 1], [-0.5, 0.82], [-0.12, 0.16]];

export const tie: Part = {
  slot: 'neck',
  label: 'Tie',
  front: [{ poly: BLADE.map(([u, v]): Point => [[0.5, u * 0.2], [v, 0.64 - 0.68 * v]]), fill: 'dark' }],
  side: [{ rect: [[1, -0.03], 0.64, 0.08, [0.9, -0.612]], fill: 'dark' }],
};
