// One floor's room, drawn in world u inside the phone's SVG: its walls, its
// light (grey when the lamps are off, the page's white with a warm glow
// under each lamp when on), the slab it stands on, its lamps and its
// figure label. What the floor holds goes in as children.

import type { ReactNode } from 'react';
import { mix } from '../../../brand/looks/color.ts';
import { DAY } from '../../../brand/looks/look.ts';
import { lampOn } from './lights.ts';
import { FLOORS, groundOf, LAMPS, WALL, type FloorId } from './plan.ts';

const P = DAY.palette;
const WIDTH = WALL.right - WALL.left;

/** Line weights, in u. */
export const HAIR = 0.3;
export const BOLD = 0.5;

export function Room({ floor, lit, children }: { floor: FloorId; lit: number; children?: ReactNode }) {
  const { top, h, fig } = FLOORS[floor];
  const ground = groundOf(floor);
  const clip = `room-${floor}`;
  return (
    <g>
      <clipPath id={clip}>
        <rect x={WALL.left} y={top} width={WIDTH} height={h} />
      </clipPath>
      <rect x={WALL.left} y={top} width={WIDTH} height={h} style={{ fill: mix(P.panel2, P.bg, lit) }} />
      <g clipPath={`url(#${clip})`}>
        {LAMPS.map((x, i) => (lampOn(lit, i, LAMPS.length) ? <circle key={x} cx={x} cy={top + 9} r={34} fill="url(#lamp-glow)" opacity={0.6 * lit} /> : null))}
      </g>
      {children}
      <rect x={WALL.left} y={ground} width={WIDTH} height={top + h - ground} style={{ fill: P.bg }} />
      <rect x={WALL.left} y={ground} width={WIDTH} height={top + h - ground} fill="url(#hatch)" />
      <line x1={WALL.left} y1={ground} x2={WALL.right} y2={ground} style={{ stroke: P.fg }} strokeWidth={HAIR} />
      <rect x={WALL.left} y={top} width={WIDTH} height={h} fill="none" style={{ stroke: P.fg }} strokeWidth={BOLD} />
      {LAMPS.map((x, i) => {
        const glows = lampOn(lit, i, LAMPS.length);
        return (
          <g key={x}>
            <line x1={x} y1={top} x2={x} y2={top + 6} style={{ stroke: P.fg }} strokeWidth={HAIR} />
            <path d={`M${x - 2.6} ${top + 8.4}L${x - 1.3} ${top + 5.8}h2.6L${x + 2.6} ${top + 8.4}Z`} style={{ fill: glows ? P.accent : P.panel, stroke: P.fg }} strokeWidth={HAIR} />
          </g>
        );
      })}
      <text x={WALL.left + 13} y={top + 4.4} style={{ fill: P.faint, fontFamily: 'var(--mono)', fontSize: 1.55, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        {fig}
      </text>
    </g>
  );
}
