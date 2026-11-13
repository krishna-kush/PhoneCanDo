import { circle, type Part } from '../part.ts';

// A bun of hair on top, tied with red.
export const bun: Part = {
  slot: 'hat',
  label: 'Bun',
  front: [circle([0.5, 0], -0.17, 0.17, { fill: 'wear' }), { rect: [[0.5, -0.12], -0.04, 0.24, 0.06], fill: 'red' }],
};
