// The glass: your apps, each a small room. A chore is done in each and
// stamped DONE; at dawn a hat is left behind, and in the morning a card
// slides in with what got done.

import { DAY } from '../../../../brand/looks/look.ts';
import { outBack, outCubic } from '../../../../engine/motion/ease.ts';
import { seg } from '../../../../engine/motion/tween.ts';
import { HAT_OFF } from '../../cast/shots/dawn.ts';
import { MOMENTS } from '../../script/moments.ts';
import { FLOORS, GLASS, groundOf } from '../plan.ts';
import { BOLD, HAIR, Room } from '../Room.tsx';

const P = DAY.palette;

/** Each app room: its name, and what its chore leaves in it. */
const APPS = [
  { name: 'Messages', result: 'on my way!' },
  { name: 'Food', result: '1 × the usual' },
  { name: 'Codes', result: '481 902' },
  { name: 'Rides', result: 'home · 8:15' },
];

/** What the morning's card says got done. */
const DONE = ['Mom knows you are coming', 'Breakfast is ordered', 'The build is fixed', 'A ride is booked for 8:15'];

const mono = (size: number, weight = 500) => ({ fontFamily: 'var(--mono)', fontSize: size, fontWeight: weight, letterSpacing: '0.12em' });

export function Glass({ lit, beat }: { lit: number; beat: number }) {
  const { top } = FLOORS.glass;
  const ground = groundOf('glass');
  const { w, h } = GLASS.window;
  const m = MOMENTS;
  const stampsGone = beat >= m.dawn.out[0];
  const card = seg(beat, m.dawn.card, m.dawn.card + 0.9, outBack(1.2));
  return (
    <Room floor="glass" lit={lit}>
      {GLASS.windows.map((x, i) => {
        const done = m.chores.done[i];
        const shown = beat >= done - 0.35 && !stampsGone;
        const stamp = seg(beat, done, done + 0.2, outBack(2.4));
        return (
          <g key={x}>
            <rect x={x - w / 2} y={ground - h} width={w} height={h} style={{ fill: lit > 0.5 ? P.bg : P.panel, stroke: P.fg }} strokeWidth={BOLD} />
            <line x1={x - w / 2} y1={ground - h + 5} x2={x + w / 2} y2={ground - h + 5} style={{ stroke: P.fg }} strokeWidth={HAIR} />
            <text x={x - w / 2 + 1.8} y={ground - h + 3.5} style={{ fill: P.dim, ...mono(1.5), textTransform: 'uppercase' }}>
              {APPS[i].name}
            </text>
            {shown ? (
              <g opacity={seg(beat, done - 0.35, done - 0.15)}>
                <rect x={x - w / 2 + 2.5} y={ground - h + 8} width={w - 5} height={6.4} style={{ fill: i === 0 ? P.red : P.panel, stroke: i === 0 ? 'none' : P.fg }} strokeWidth={HAIR} />
                <text x={x} y={ground - h + 12.3} textAnchor="middle" style={{ fill: i === 0 ? P.onPrimary : P.fg, fontFamily: 'var(--sans)', fontSize: 2.5, fontWeight: 600 }}>
                  {APPS[i].result}
                </text>
              </g>
            ) : null}
            {beat >= done && !stampsGone ? (
              <g transform={`translate(${x} ${ground - h + 22}) rotate(${-11 + i * 4}) scale(${2.4 - 1.4 * stamp})`} opacity={Math.min(1, stamp * 1.5)}>
                <rect x={-10} y={-3.6} width={20} height={7.2} fill="none" style={{ stroke: P.red }} strokeWidth={0.7} />
                <text y={1.6} textAnchor="middle" style={{ fill: P.red, ...mono(4.4, 700) }}>
                  DONE
                </text>
              </g>
            ) : null}
          </g>
        );
      })}

      {/* The hat left behind: a brim and a crown, until its owner comes back for it. */}
      {beat >= HAT_OFF && beat < m.dawn.grab ? (
        <g style={{ fill: P.fg }}>
          <rect x={GLASS.hat - 4.2} y={ground - 1.1} width={8.4} height={1.1} />
          <rect x={GLASS.hat - 2.6} y={ground - 6.2} width={5.2} height={5.2} />
        </g>
      ) : null}

      {/* 07:00: what got done. */}
      {card > 0 ? (
        <g transform={`translate(0 ${-(1 - card) * 70})`}>
          <rect x={-46 + 1.4} y={top + 9 + 1.4} width={92} height={44} style={{ fill: P.accent }} />
          <rect x={-46} y={top + 9} width={92} height={44} style={{ fill: P.bg, stroke: P.fg }} strokeWidth={BOLD} />
          <text x={-41} y={top + 16} style={{ fill: P.faint, ...mono(1.7) }}>
            07:00 · WHILE YOU WERE AWAY
          </text>
          {DONE.map((line, i) => (
            <g key={line} opacity={seg(beat, m.dawn.card + 0.8 + i * 0.3, m.dawn.card + 1 + i * 0.3, outCubic)}>
              <text x={-41} y={top + 24.5 + i * 7} style={{ fill: P.red, fontFamily: 'var(--sans)', fontSize: 4, fontWeight: 700 }}>
                ✓
              </text>
              <text x={-35} y={top + 24.5 + i * 7} style={{ fill: P.fg, fontFamily: 'var(--serif)', fontSize: 4.6 }}>
                {line}
              </text>
            </g>
          ))}
        </g>
      ) : null}
    </Room>
  );
}
