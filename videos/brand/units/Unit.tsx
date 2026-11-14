// A unit of the A-series, drawn as SVG from the shared spec (mascot/) as the
// site paints one: its two blocks, eyes and wear. It stands at its feet:
// its place is the ground under it, `lift` raises the body off that, and a
// shadow stays behind on the ground.

import type { Eyes } from '../../../mascot/layout/eyes.ts';
import { figure, type Facing } from '../../../mascot/layout/figure.ts';
import { pathOf } from '../../../mascot/layout/path.ts';
import type { Box, Color } from '../../../mascot/layout/types.ts';
import { useStage } from '../../engine/stage/useStage.ts';
import { BODY, type Look } from './body.ts';

export type UnitProps = {
  look: Look;
  /** Its short side, in u. */
  size: number;
  facing?: Facing;
  /** Side on, which way it faces: -1 left, 1 right. */
  toward?: -1 | 1;
  /** Where its pupils point, -1 to 1 each way. */
  gaze?: readonly [number, number];
  eyes?: Eyes;
  /** Squash and stretch, about its feet. */
  sx?: number;
  sy?: number;
  /** How far its body is off the ground, in short sides. */
  lift?: number;
  /** Leaning about its feet, in degrees. */
  lean?: number;
  /** Its ground shadow's strength, 0 to 1; 0 for none. */
  shadow?: number;
  opacity?: number;
};

/** A unit's inks as the site paints them: wear in the text colour, eyes white on a dark pupil. */
const INK: Record<Color, string> = {
  red: 'var(--red)',
  amber: 'var(--accent)',
  eye: 'var(--on-primary)',
  dark: 'var(--hole)',
  wear: 'var(--fg)',
};

const n = (v: number) => Number(v.toFixed(2));

const Block = ({ b, fill }: { b: Box; fill: string }) => <rect x={n(b.x)} y={n(b.y)} width={n(b.w)} height={n(b.h)} style={{ fill }} />;

export function Unit({ look, size, lift = 0, lean = 0, shadow = 0.18, opacity, ...stance }: UnitProps) {
  const { u } = useStage();
  const S = size * u;
  const f = figure(look, { size: S, body: BODY, ...stance });
  const up = -lift * S;
  const spread = f.bounds.w * 0.55 * (1 - Math.min(0.6, lift * 0.35));
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'visible', opacity }}>
      {shadow > 0 ? (
        <ellipse cx={n(f.bounds.x + f.bounds.w / 2)} cy={0} rx={n(spread)} ry={n(S * 0.07)} style={{ fill: 'var(--fg)' }} opacity={n(shadow * (1 - Math.min(0.7, lift * 0.4)))} />
      ) : null}
      <g transform={`translate(0 ${n(up)}) rotate(${n(lean)})`}>
        <Block b={f.back} fill={INK[f.back.ink]} />
        <Block b={f.front} fill={INK[f.front.ink]} />
        {f.eyes.map((e, i) => (
          <g key={i}>
            <Block b={e.lid} fill={INK.eye} />
            {e.pupil ? <Block b={e.pupil} fill={INK.dark} /> : null}
          </g>
        ))}
        {f.marks.map((m, i) => (
          <path
            key={i}
            d={pathOf(m)}
            style={{ fill: m.fill ? INK[m.fill] : 'none', stroke: m.stroke ? INK[m.stroke] : 'none' }}
            strokeWidth={n(m.width)}
            opacity={m.alpha < 1 ? m.alpha : undefined}
          />
        ))}
      </g>
    </svg>
  );
}
