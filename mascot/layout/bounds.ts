// The box round everything a unit draws: its blocks, and every mark with
// half its stroke, an arc by points along it.

import type { Box, Drawn } from './types.ts';

type Pt = readonly [number, number];

function points(d: Drawn): Pt[] {
  switch (d.kind) {
    case 'rect':
      return [[d.x, d.y], [d.x + d.w, d.y + d.h]];
    case 'poly':
    case 'line':
      return [...d.points];
    case 'arc': {
      const out: Pt[] = [];
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const a = ((d.from + ((d.to - d.from) * i) / steps) * Math.PI) / 180;
        out.push([d.x + d.rx * Math.cos(a), d.y + d.ry * Math.sin(a)]);
      }
      return out;
    }
  }
}

export function boundsOf(boxes: readonly Box[], marks: readonly Drawn[]): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const add = (x: number, y: number, pad: number) => {
    x0 = Math.min(x0, x - pad);
    y0 = Math.min(y0, y - pad);
    x1 = Math.max(x1, x + pad);
    y1 = Math.max(y1, y + pad);
  };
  for (const b of boxes) {
    add(b.x, b.y, 0);
    add(b.x + b.w, b.y + b.h, 0);
  }
  for (const d of marks) {
    const pad = d.stroke ? d.width / 2 : 0;
    for (const [x, y] of points(d)) add(x, y, pad);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
