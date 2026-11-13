import type { Mark, Part } from '../part.ts';

export const CROWN: Mark = { rect: [[0.04, 0], -0.18, [0.92, 0], 0.2], fill: 'wear' };

// A cap, its visor out the way it looks; from behind, its strap.
export const cap: Part = {
  slot: 'hat',
  label: 'Cap',
  front: [CROWN, { rect: [[0.6, 0], -0.02, [0.4, 0.26], 0.07], fill: 'wear', follow: true }],
  back: [CROWN, { rect: [[0.5, -0.07], -0.06, 0.14, 0.06], fill: 'dark' }],
};
