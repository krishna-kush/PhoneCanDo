// A laid-out mark as an SVG path's d, for any SVG: the website's, or React
// Native's. Arcs become two half turns at most, so a whole ellipse closes.

import type { Drawn } from './types.ts';

const n = (v: number) => Number(v.toFixed(3));

function arcPath(d: Extract<Drawn, { kind: 'arc' }>): string {
  const at = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${n(d.x + d.rx * Math.cos(a))} ${n(d.y + d.ry * Math.sin(a))}`;
  };
  const sweep = d.to - d.from;
  const steps = Math.max(1, Math.ceil(Math.abs(sweep) / 180));
  let p = `M${at(d.from)}`;
  for (let i = 1; i <= steps; i++) p += `A${n(d.rx)} ${n(d.ry)} 0 0 ${sweep > 0 ? 1 : 0} ${at(d.from + (sweep * i) / steps)}`;
  // A filled arc closes along its chord, as a canvas's does.
  return d.fill ? `${p}Z` : p;
}

export function pathOf(d: Drawn): string {
  switch (d.kind) {
    case 'rect':
      return `M${n(d.x)} ${n(d.y)}h${n(d.w)}v${n(d.h)}h${n(-d.w)}Z`;
    case 'poly':
      return `M${d.points.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z`;
    case 'line':
      return `M${n(d.points[0][0])} ${n(d.points[0][1])}L${n(d.points[1][0])} ${n(d.points[1][1])}`;
    case 'arc':
      return arcPath(d);
  }
}
