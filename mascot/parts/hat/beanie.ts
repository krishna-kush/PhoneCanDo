import { circle, type Mark, type Part } from '../part.ts';

const DOME: Mark = { arc: [[0.5, 0], 0.04, [0.44, 0], 0.44, 180, 360], fill: 'wear' };
const BAND: Mark = { rect: [[0.06, 0], -0.02, [0.88, 0], 0.07], fill: 'wear' };

// A knitted dome with a red pompom.
export const beanie: Part = {
  slot: 'hat',
  label: 'Beanie',
  front: [DOME, BAND, circle([0.5, 0], -0.46, 0.08, { fill: 'red' })],
  side: [DOME, BAND, circle([0.39, 0], -0.46, 0.08, { fill: 'red' })],
};
