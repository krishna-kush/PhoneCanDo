import type { Mark, Part } from '../part.ts';

// The base it stands on, in the page's own ink so it reads on either theme.
const BASE: Mark = { rect: [[0.5, -0.17], -0.07, 0.34, 0.07], fill: 'wear' };
// The amber dome, ringed in the page's ink so it holds on a light page too.
const DOME: Mark = { arc: [[0.5, 0], -0.07, 0.13, 0.17, 180, 360], fill: 'amber', stroke: 'wear', width: 0.03 };
// The lamp's glint.
const GLINT: Mark = { rect: [[0.5, -0.06], -0.19, 0.04, 0.07], fill: 'eye', alpha: 0.8 };

// A warning beacon for the front desk, who asks before you do what can't
// be undone, as hazard tape does: an amber dome on a base, the lamp's
// glint, and a flash out to each side. Side on and from behind, the same
// lamp, its flash still out both ways.
export const beacon: Part = {
  slot: 'hat',
  label: 'Beacon',
  front: [
    { line: [[[0.5, -0.2], -0.17], [[0.5, -0.34], -0.25]], stroke: 'amber', width: 0.05, alpha: 0.85 },
    { line: [[[0.5, -0.21], -0.08], [[0.5, -0.37], -0.08]], stroke: 'amber', width: 0.05, alpha: 0.85 },
    { line: [[[0.5, 0.2], -0.17], [[0.5, 0.34], -0.25]], stroke: 'amber', width: 0.05, alpha: 0.85 },
    { line: [[[0.5, 0.21], -0.08], [[0.5, 0.37], -0.08]], stroke: 'amber', width: 0.05, alpha: 0.85 },
    DOME,
    GLINT,
    BASE,
  ],
  side: 'same',
};
