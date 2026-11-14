// The bunks, where the crew sleeps: three double beds either side of the
// aisle, A-01's own bed in it, and the cord that works the lamps.

import { DAY } from '../../../../brand/looks/look.ts';
import { MOMENTS } from '../../script/moments.ts';
import { BUNK, CORD, FLOORS, groundOf, OWN_BED } from '../plan.ts';
import { HAIR, Room } from '../Room.tsx';

const P = DAY.palette;

/** How far the cord's knob dips when it is pulled, in u, [beat] being now. */
function pulled(beat: number): number {
  const since = Math.min(...[MOMENTS.lights.lamps[0], MOMENTS.dawn.out[3]].map((at) => (beat >= at ? beat - at : Infinity)));
  return since < 1.5 ? 2.4 * Math.exp(-4 * since) * Math.cos(since * Math.PI * 5) : 0;
}

export function Bunks({ lit, beat }: { lit: number; beat: number }) {
  const ground = groundOf('bunks');
  const half = BUNK.w / 2;
  const knob = CORD.y + pulled(beat);
  return (
    <Room floor="bunks" lit={lit}>
      {BUNK.doubles.map((x) => (
        <g key={x} style={{ stroke: P.fg }} strokeWidth={HAIR} fill="none">
          {/* The posts, the upper bed's board and both mattresses. */}
          <line x1={x - half} y1={ground - BUNK.upper - 7} x2={x - half} y2={ground} />
          <line x1={x + half} y1={ground - BUNK.upper - 7} x2={x + half} y2={ground} />
          <rect x={x - half} y={ground - BUNK.upper} width={BUNK.w} height={1.8} style={{ fill: P.panel }} />
          <rect x={x - half} y={ground - 1.8} width={BUNK.w} height={1.8} style={{ fill: P.panel }} />
          <line x1={x - half} y1={ground - BUNK.upper - 7} x2={x - half + 3} y2={ground - BUNK.upper - 7} />
          <line x1={x + half - 3} y1={ground - BUNK.upper - 7} x2={x + half} y2={ground - BUNK.upper - 7} />
        </g>
      ))}
      {/* A-01's own bed in the aisle, and the lamp cord over it. */}
      <g style={{ stroke: P.fg }} strokeWidth={HAIR} fill="none">
        <rect x={OWN_BED.x - half - 1} y={ground - 1.8} width={BUNK.w + 2} height={1.8} style={{ fill: P.panel }} />
        <line x1={OWN_BED.x - half - 1} y1={ground - 6} x2={OWN_BED.x - half - 1} y2={ground} />
        <line x1={OWN_BED.x + half + 1} y1={ground - 6} x2={OWN_BED.x + half + 1} y2={ground} />
        <line x1={CORD.x} y1={FLOORS.bunks.top} x2={CORD.x} y2={knob} />
        <rect x={CORD.x - 1.1} y={knob} width={2.2} height={2.6} style={{ fill: P.red, stroke: 'none' }} />
      </g>
    </Room>
  );
}
