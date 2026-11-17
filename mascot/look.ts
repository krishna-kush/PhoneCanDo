// One unit's look: its design, its shape and which ink is in front. What an
// agent keeps, and what a page hands round.

import { SHAPES, type Shape } from './body.ts';
import { isWearable, type DesignId } from './designs.ts';

export type Look = {
  design: DesignId;
  shape: Shape;
  /** The amber block in front, as the loader's swap frames have it. */
  swap: boolean;
};

/** The brand mark's own look: plain, square, red in front (A-01). */
export const PLAIN: Look = { design: 'plain', shape: 'square', swap: false };

export const lookKey = (l: Look) => `${l.design}:${l.shape}:${l.swap ? 1 : 0}`;

export const sameLook = (a: Look, b: Look) => lookKey(a) === lookKey(b);

/**
 * An agent's look read back from storage, or null when it is not one (or
 * names a design we no longer have, or one of our own characters', which
 * no agent wears).
 */
export function readLook(v: unknown): Look | null {
  if (!v || typeof v !== 'object') return null;
  const { design, shape, swap } = v as Record<string, unknown>;
  if (!isWearable(design) || !SHAPES.includes(shape as Shape) || typeof swap !== 'boolean') return null;
  return { design, shape: shape as Shape, swap };
}
