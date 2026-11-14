// The landing: a wall with a round gate in it, locked until the fingerprint
// arms it. Then its plate is stamped and the gate rolls aside. At dawn it
// rolls shut again.

import { DAY } from '../../../../brand/looks/look.ts';
import { outBack, outCubic } from '../../../../engine/motion/ease.ts';
import { seg } from '../../../../engine/motion/tween.ts';
import { MOMENTS } from '../../script/moments.ts';
import { FLOORS, groundOf, LANDING } from '../plan.ts';
import { BOLD, HAIR, Room } from '../Room.tsx';

const P = DAY.palette;

/** How far open the gate is at [beat], 0 to 1. */
export const gateOpen = (beat: number) => seg(beat, MOMENTS.gate.armed + 0.15, MOMENTS.gate.armed + 1.1, outCubic) * (1 - seg(beat, MOMENTS.dawn.shut - 0.5, MOMENTS.dawn.shut, outCubic));

export function Landing({ lit, beat }: { lit: number; beat: number }) {
  const { top, h } = FLOORS.landing;
  const ground = groundOf('landing');
  const g = LANDING.gate;
  const open = gateOpen(beat);
  const armed = beat >= MOMENTS.gate.armed;
  const stamp = seg(beat, MOMENTS.gate.armed, MOMENTS.gate.armed + 0.22, outBack(2.4));
  const plate = { x: 2, y: top + 7, w: 22, h: 11 };
  return (
    <Room floor="landing" lit={lit}>
      {/* The stairs on, behind the wall. */}
      <path d={`M${g.x + 6} ${ground}h5v-6h5v-6h5v-6h5v-6h5`} fill="none" style={{ stroke: P.fg }} strokeWidth={HAIR} />
      {/* The wall, with the gate's opening cut in it. */}
      <rect x={LANDING.wall - 2} y={top} width={4} height={h} style={{ fill: P.bg, stroke: P.fg }} strokeWidth={HAIR} />
      <rect x={LANDING.wall - 2} y={top} width={4} height={h} fill="url(#hatch)" />
      <circle cx={g.x} cy={g.y} r={g.r} style={{ fill: P.bg, stroke: P.fg }} strokeWidth={HAIR} />
      {/* The gate: a wheel that rolls aside. */}
      <g transform={`translate(${open * 31} 0) rotate(${open * 230} ${g.x} ${g.y})`}>
        <circle cx={g.x} cy={g.y} r={g.r} style={{ fill: P.panel, stroke: P.fg }} strokeWidth={BOLD} />
        <circle cx={g.x} cy={g.y} r={g.r - 2.6} fill="none" style={{ stroke: P.fg }} strokeWidth={HAIR} />
        {[0, 45, 90, 135].map((a) => (
          <line key={a} x1={g.x - (g.r - 2.6)} y1={g.y} x2={g.x + (g.r - 2.6)} y2={g.y} transform={`rotate(${a} ${g.x} ${g.y})`} style={{ stroke: P.fg }} strokeWidth={HAIR} />
        ))}
        <circle cx={g.x} cy={g.y} r={3.2} style={{ fill: armed ? P.accent : P.red, stroke: P.fg }} strokeWidth={HAIR} />
      </g>

      {/* The plate beside it: a fingerprint, and the stamp once it is armed. */}
      <rect x={plate.x} y={plate.y} width={plate.w} height={plate.h} style={{ fill: P.bg, stroke: P.fg }} strokeWidth={HAIR} />
      {[1.2, 2.3, 3.4].map((r) => (
        <path key={r} d={`M${plate.x + plate.w / 2 - r} ${plate.y + 6.6}a${r} ${r * 1.15} 0 0 1 ${r * 2} 0`} fill="none" style={{ stroke: armed ? P.red : P.dim }} strokeWidth={0.45} />
      ))}
      <text x={plate.x + plate.w / 2} y={plate.y + 9} textAnchor="middle" style={{ fill: P.faint, fontFamily: 'var(--mono)', fontSize: 1.15, letterSpacing: '0.12em' }}>
        PHONE CONTROL
      </text>
      {armed ? (
        <g transform={`translate(${plate.x + plate.w / 2} ${plate.y + plate.h / 2}) rotate(-7) scale(${2.2 - 1.2 * stamp})`} opacity={Math.min(1, stamp * 1.4)}>
          <rect x={-11.5} y={-2.7} width={23} height={5.4} fill="none" style={{ stroke: P.red }} strokeWidth={0.55} />
          <text y={1.05} textAnchor="middle" style={{ fill: P.red, fontFamily: 'var(--mono)', fontSize: 2.5, fontWeight: 700, letterSpacing: '0.12em' }}>
            ARMED BY YOU
          </text>
        </g>
      ) : null}
    </Room>
  );
}
