import { circle, type Part } from '../part.ts';

// A collar with a bell, in the other ink.
export const collar: Part = {
  slot: 'neck',
  label: 'Collar',
  front: [{ rect: [0, 0.64, [1, 0], 0.07], fill: 'dark' }, circle([0.5, 0], 0.78, 0.075, { fill: 'back' })],
  side: [{ rect: [0, 0.64, [1, 0], 0.07], fill: 'dark' }, circle([1, -0.08], 0.78, 0.07, { fill: 'back' })],
};
