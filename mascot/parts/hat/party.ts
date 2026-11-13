import { circle, type Part } from '../part.ts';

// An amber party cone with a red pompom.
export const party: Part = {
  slot: 'hat',
  label: 'Party hat',
  front: [
    { poly: [[[0.5, -0.2], 0.02], [[0.5, 0.2], 0.02], [[0.5, 0.04], -0.44]], fill: 'amber', follow: true },
    { line: [[[0.5, -0.12], -0.12], [[0.5, 0.13], -0.08]], stroke: 'red', width: 0.05, follow: true },
    circle([0.5, 0.04], -0.48, 0.07, { fill: 'red', follow: true }),
  ],
};
