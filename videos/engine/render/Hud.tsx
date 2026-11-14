// A review label burnt into the corner of a frame: the shot, the beat and
// the time, so a still or a filmstrip says where on the beat line it is.
// Only drawn when a render asks for it (`hud` in its props).

import { useBeat, useTempo } from '../stage/Clock.tsx';
import { useStage } from '../stage/useStage.ts';
import type { Film } from './film.ts';

export function Hud({ film }: { film: Film }) {
  const beat = useBeat();
  const tempo = useTempo();
  const { u } = useStage();
  const { shot, local } = film.line.at(beat);
  return (
    <div
      style={{
        position: 'absolute',
        left: u * 2,
        bottom: u * 2,
        padding: `${u * 0.8}px ${u * 1.4}px`,
        background: '#ffffff',
        border: `${Math.max(1, u * 0.2)}px solid #0d0d0d`,
        color: '#0d0d0d',
        font: `600 ${u * 3}px ui-monospace, monospace`,
        whiteSpace: 'nowrap',
      }}
    >
      {shot.id}+{local.toFixed(2)} · b{beat.toFixed(2)} · {(beat * tempo.beat).toFixed(2)}s
    </div>
  );
}
