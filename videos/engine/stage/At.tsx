// A pin: its children stand at a place on the stage, given in u, turned and
// scaled about that place. Everything a film places goes through one.

import type { CSSProperties, ReactNode } from 'react';
import { useStage } from './useStage.ts';

export type AtProps = {
  /** In u, from the parent pin (or the frame's top left). */
  x?: number;
  y?: number;
  /** In degrees. */
  turn?: number;
  scale?: number;
  /** Stretch each way, after the scale. */
  sx?: number;
  sy?: number;
  opacity?: number;
  z?: number;
  style?: CSSProperties;
  children?: ReactNode;
};

const n = (v: number) => Number(v.toFixed(3));

export function At({ x = 0, y = 0, turn = 0, scale = 1, sx = 1, sy = 1, opacity, z, style, children }: AtProps) {
  const { u } = useStage();
  if (opacity !== undefined && opacity <= 0) return null;
  const moves = [`translate(${n(x * u)}px, ${n(y * u)}px)`];
  if (turn) moves.push(`rotate(${n(turn)}deg)`);
  if (scale !== 1 || sx !== 1 || sy !== 1) moves.push(`scale(${n(scale * sx)}, ${n(scale * sy)})`);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transformOrigin: '0 0',
        transform: moves.join(' '),
        opacity: opacity === undefined || opacity >= 1 ? undefined : n(opacity),
        zIndex: z,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
