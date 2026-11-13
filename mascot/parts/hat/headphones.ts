import type { Mark, Part } from '../part.ts';

const BAND: Mark = { arc: [[0.5, 0], 0.2, [0.5, 0.05], 0.36, 180, 360], stroke: 'wear', width: 0.06 };

/** A band over the top and a cup each side, [cup] S wide; side on, one cup. */
export function cans(cup: number): { front: Mark[]; side: Mark[] } {
  const left: Mark = { rect: [-0.85 * cup, 0.12, cup, 0.3], fill: 'wear' };
  const right: Mark = { rect: [[1, -0.15 * cup], 0.12, cup, 0.3], fill: 'wear' };
  return {
    front: [BAND, left, right],
    side: [BAND, { rect: [[0.4, -0.6 * cup], 0.1, 1.2 * cup, 0.32], fill: 'wear' }],
  };
}

const { front, side } = cans(0.15);

export const headphones: Part = { slot: 'hat', label: 'Headphones', front, side };
