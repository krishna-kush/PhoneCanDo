// The ground a film stands on: the site's page, white with its faint
// blueprint grid, fading out from a point. It fills the frame; a film that
// moves its camera slides the grid with it (dx, dy) so the page seems to
// pass under the world.

import { AbsoluteFill } from 'remotion';
import { useStage } from '../../../engine/stage/useStage.ts';

export type GroundProps = {
  /** The grid's strength, 0 to 1. */
  grid?: number;
  /** Where the grid shows most, as a share of the frame. */
  gx?: number;
  gy?: number;
  /** How far the grid has slid, in u. */
  dx?: number;
  dy?: number;
  /** One square of the grid, in u. */
  cell?: number;
};

export function Ground({ grid = 1, gx = 0.5, gy = 0.5, dx = 0, dy = 0, cell = 6 }: GroundProps) {
  const { u } = useStage();
  const line = `${(u * 0.14).toFixed(2)}px`;
  const size = `${(cell * u).toFixed(2)}px`;
  return (
    <AbsoluteFill style={{ background: 'var(--bg)' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: grid,
          backgroundImage: `linear-gradient(to right, var(--grid) ${line}, transparent ${line}), linear-gradient(to bottom, var(--grid) ${line}, transparent ${line})`,
          backgroundSize: `${size} ${size}`,
          backgroundPosition: `${(dx * u).toFixed(2)}px ${(dy * u).toFixed(2)}px`,
          maskImage: `radial-gradient(75% 85% at ${(gx * 100).toFixed(1)}% ${(gy * 100).toFixed(1)}%, #000 0%, transparent 95%)`,
        }}
      />
    </AbsoluteFill>
  );
}
