import type { Part } from '../part.ts';
import { CROWN } from './cap.ts';

// A cap turned round: its visor points behind, and from behind faces us.
export const capBack: Part = {
  slot: 'hat',
  label: 'Backwards cap',
  front: [CROWN, { rect: [-0.26, -0.02, [0.4, 0.26], 0.07], fill: 'wear', follow: true }],
  back: [CROWN, { rect: [-0.04, -0.04, [1, 0.08], 0.07], fill: 'wear' }],
};
