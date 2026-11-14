// The workshop: a terminal the size of the wall, the breaker that wakes it,
// and the benches. Its lines come up one by one once the breaker is thrown.

import { DAY } from '../../../../brand/looks/look.ts';
import { MOMENTS } from '../../script/moments.ts';
import { groundOf, WORKSHOP } from '../plan.ts';
import { BOLD, HAIR, Room } from '../Room.tsx';

const P = DAY.palette;

/** What the terminal says, a line for each typing moment. */
const LINES = ['$ apt install ffmpeg', 'Reading package lists… Done', '$ git clone your-idea', '$ pnpm test', '✓ 74 passed', '$ ship it'];

export function Workshop({ lit, beat }: { lit: number; beat: number }) {
  const ground = groundOf('workshop');
  const t = WORKSHOP.terminal;
  const on = beat >= MOMENTS.tools.breaker;
  const awake = lit > 0.5;
  return (
    <Room floor="workshop" lit={lit}>
      <rect x={t.x} y={t.y} width={t.w} height={t.h} style={{ fill: awake ? P.bg : P.panel2, stroke: P.fg }} strokeWidth={BOLD} />
      <line x1={t.x} y1={t.y + 4.2} x2={t.x + t.w} y2={t.y + 4.2} style={{ stroke: P.fg }} strokeWidth={HAIR} />
      <text x={t.x + 2} y={t.y + 3} style={{ fill: P.faint, fontFamily: 'var(--mono)', fontSize: 1.5, letterSpacing: '0.14em' }}>
        A-01 · LINUX · ROOT WITHOUT ROOTING
      </text>
      {awake
        ? LINES.map((line, i) =>
            beat >= MOMENTS.tools.typing[i] ? (
              <text key={line} x={t.x + 2.4} y={t.y + 9.6 + i * 4.6} style={{ fill: line.startsWith('✓') ? P.red : P.fg, fontFamily: 'var(--mono)', fontSize: 2.7, fontWeight: 500 }}>
                {line}
              </text>
            ) : null,
          )
        : null}

      {/* The breaker: a box on the wall, its lever up once thrown. */}
      <rect x={WORKSHOP.breaker + 6} y={ground - 25} width={6} height={9} style={{ fill: P.bg, stroke: P.fg }} strokeWidth={HAIR} />
      <line x1={WORKSHOP.breaker + 9} y1={ground - 20.5} x2={WORKSHOP.breaker + 9 + (on ? 2.4 : -2.4)} y2={ground - 20.5 + (on ? -3 : 3)} style={{ stroke: on ? P.red : P.fg }} strokeWidth={0.9} strokeLinecap="square" />

      {/* The benches, and the small light that stays on the phone. */}
      {WORKSHOP.bench.map((x) => (
        <g key={x} style={{ stroke: P.fg }} strokeWidth={HAIR}>
          <rect x={x - 7.5} y={ground - 16.5} width={15} height={1.4} style={{ fill: P.panel }} />
          <line x1={x - 6.5} y1={ground - 15.1} x2={x - 6.5} y2={ground} />
          <line x1={x + 6.5} y1={ground - 15.1} x2={x + 6.5} y2={ground} />
        </g>
      ))}
      <rect x={66} y={ground - 31} width={4.4} height={4.4} style={{ fill: awake ? P.accent : P.panel, stroke: P.fg }} strokeWidth={HAIR} />
      <text x={71} y={ground - 33} textAnchor="end" style={{ fill: P.faint, fontFamily: 'var(--mono)', fontSize: 1.3, letterSpacing: '0.12em' }}>
        MODEL · ON DEVICE
      </text>
    </Room>
  );
}
