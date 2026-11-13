import type { Part, Point } from '../part.ts';

const PEAKS: [number, number][] = [[-1, 1], [-0.76, 0.15], [-0.36, 0.72], [0, 0], [0.36, 0.72], [0.76, 0.15], [1, 1]];
const hair = (shift: number): Point[] => PEAKS.map(([u, v]) => [[0.5, shift + u * 0.22], -0.26 + v * 0.27]);

// A tuft of hair; side on, swept back.
export const tuft: Part = {
  slot: 'hat',
  label: 'Tuft',
  front: [{ poly: hair(0), fill: 'wear' }],
  side: [{ poly: hair(-0.1), fill: 'wear' }],
};
