// The phone, cut open: its body, the four floors inside and the shaft with
// its ladder up the left wall, drawn as one SVG in world u. The solid
// between the rooms is hatched, as a section drawing has it.

import { DAY } from '../../../brand/looks/look.ts';
import { useStage } from '../../../engine/stage/useStage.ts';
import { Bunks } from './floors/Bunks.tsx';
import { Glass } from './floors/Glass.tsx';
import { Landing } from './floors/Landing.tsx';
import { Workshop } from './floors/Workshop.tsx';
import { litAt } from './lights.ts';
import { FLOORS, groundOf, PHONE, SHAFT, WALL, type FloorId } from './plan.ts';
import { BOLD, HAIR } from './Room.tsx';

const P = DAY.palette;

/** Room around the phone for what stands on its roof. */
const PAD = 26;
const BOX = { x: PHONE.x - PAD, y: PHONE.y - PAD, w: PHONE.w + PAD * 2, h: PHONE.h + PAD * 2 };

/** The ladder: its rails either side of the shaft's middle, a rung every few u, from the glass down to the bunks. */
const RAIL = 3.2;
const RUNG = 3.6;
const LADDER = { top: groundOf('glass') - 4, bottom: groundOf('bunks') };

export function Phone({ beat }: { beat: number }) {
  const { u } = useStage();
  const lit = Object.fromEntries((Object.keys(FLOORS) as FloorId[]).map((f) => [f, litAt(f, beat)])) as Record<FloorId, number>;
  const rungs = Array.from({ length: Math.floor((LADDER.bottom - LADDER.top) / RUNG) }, (_, i) => LADDER.top + (i + 0.5) * RUNG);
  return (
    <svg viewBox={`${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}`} style={{ position: 'absolute', left: BOX.x * u, top: BOX.y * u, width: BOX.w * u, height: BOX.h * u, overflow: 'visible' }}>
      <defs>
        <pattern id="hatch" width={2.2} height={2.2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={2.2} style={{ stroke: P.fg }} strokeOpacity={0.22} strokeWidth={0.34} />
        </pattern>
        <radialGradient id="lamp-glow">
          <stop offset="0%" style={{ stopColor: P.accent }} stopOpacity={0.55} />
          <stop offset="55%" style={{ stopColor: P.accent }} stopOpacity={0.16} />
          <stop offset="100%" style={{ stopColor: P.accent }} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* The body, with the brand's hard shadow, its solid hatched. */}
      <rect x={PHONE.x + 2.4} y={PHONE.y + 2.4} width={PHONE.w} height={PHONE.h} rx={PHONE.r} style={{ fill: P.accent }} />
      <rect x={PHONE.x} y={PHONE.y} width={PHONE.w} height={PHONE.h} rx={PHONE.r} style={{ fill: P.bg }} />
      <rect x={PHONE.x} y={PHONE.y} width={PHONE.w} height={PHONE.h} rx={PHONE.r} fill="url(#hatch)" style={{ stroke: P.fg }} strokeWidth={0.8} />
      {/* The camera hole in its top edge. */}
      <circle cx={0} cy={(PHONE.y + FLOORS.glass.top) / 2} r={1.9} style={{ fill: P.hole }} />

      <Glass lit={lit.glass} beat={beat} />
      <Landing lit={lit.landing} beat={beat} />
      <Workshop lit={lit.workshop} beat={beat} />
      <Bunks lit={lit.bunks} beat={beat} />

      {/* The shaft through the slabs, and the ladder. */}
      {(['glass', 'landing', 'workshop'] as const).map((f) => (
        <rect key={f} x={WALL.left + BOLD / 2} y={groundOf(f)} width={(SHAFT - WALL.left) * 2 - BOLD / 2} height={FLOORS[f].top + FLOORS[f].h - groundOf(f) + (f === 'glass' ? 4 : 4) + BOLD} style={{ fill: P.bg }} />
      ))}
      <g style={{ stroke: P.fg }} strokeWidth={HAIR}>
        <line x1={SHAFT - RAIL} y1={LADDER.top} x2={SHAFT - RAIL} y2={LADDER.bottom} />
        <line x1={SHAFT + RAIL} y1={LADDER.top} x2={SHAFT + RAIL} y2={LADDER.bottom} />
        {rungs.map((y) => (
          <line key={y} x1={SHAFT - RAIL} y1={y} x2={SHAFT + RAIL} y2={y} />
        ))}
      </g>
    </svg>
  );
}
