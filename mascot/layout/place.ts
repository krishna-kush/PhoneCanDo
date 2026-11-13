// From a part's places to numbers: each place is measured against a box
// (the front block, or an eye) and S across and down, which a squash or
// stretch scales as it does the body.

import type { At } from '../parts/part.ts';
import type { Box } from './types.ts';

export type Frame = { box: Box; sx: number; sy: number };

const split = (a: At): readonly [number, number] => (typeof a === 'number' ? [0, a] : a);

export const across = (f: Frame, a: At) => {
  const [k, s] = split(a);
  return f.box.x + k * f.box.w + s * f.sx;
};

export const down = (f: Frame, a: At) => {
  const [k, s] = split(a);
  return f.box.y + k * f.box.h + s * f.sy;
};

export const wide = (f: Frame, a: At) => {
  const [k, s] = split(a);
  return k * f.box.w + s * f.sx;
};

export const high = (f: Frame, a: At) => {
  const [k, s] = split(a);
  return k * f.box.h + s * f.sy;
};
