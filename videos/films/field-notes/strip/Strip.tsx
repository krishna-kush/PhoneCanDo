// The narrator's strip along the bottom of the frame: the film's label, the
// night's clock, and his line for the shot, which the crew fixes. A line
// stays up until the next one comes.

import { useBeat } from '../../../engine/stage/Clock.tsx';
import { useStage } from '../../../engine/stage/useStage.ts';
import { seg } from '../../../engine/motion/tween.ts';
import { LINE, type ShotId } from '../beats.ts';
import { clockAt } from '../script/clock.ts';
import { LINES } from '../script/lines.ts';
import { MOMENTS } from '../script/moments.ts';
import { Caption } from './Caption.tsx';

/** The strip's height, in u. */
export const STRIP = 24;

/** The frame's side margin, in u. */
const MARGIN = 9;

/** When each line comes up, and when it is fixed. */
const TIMES: Record<ShotId, { line: number; strike?: number; write?: number; right?: number }> = {
  lights: MOMENTS.lights,
  crew: MOMENTS.crew,
  tools: MOMENTS.tools,
  gate: MOMENTS.gate,
  chores: MOMENTS.chores,
  song: MOMENTS.song,
  dawn: MOMENTS.dawn,
  end: MOMENTS.end,
};

const ORDER = LINE.shots.map((s) => s.id);

export function Strip() {
  const beat = useBeat();
  const { u, w, H } = useStage();
  // The line up now: the last one whose moment has come.
  const index = Math.max(0, ORDER.findLastIndex((id) => TIMES[id].line <= beat));
  const shot = ORDER[index];
  const times = TIMES[shot];
  const next = ORDER[index + 1];
  const since = beat - times.line;
  const leaving = next ? seg(beat, TIMES[next].line - 0.3, TIMES[next].line) : 0;
  return (
    <div style={{ position: 'absolute', left: 0, top: (H - STRIP) * u, width: w, height: STRIP * u, background: 'var(--bg)', borderTop: `${0.3 * u}px solid var(--fg)` }}>
      <div className="label" style={{ position: 'absolute', left: MARGIN * u, top: 3.4 * u }}>
        Field notes · {String(index + 1).padStart(2, '0')} / {String(ORDER.length).padStart(2, '0')}
      </div>
      <div className="label fg" style={{ position: 'absolute', right: MARGIN * u, top: 2.7 * u, fontSize: 2.9 * u, letterSpacing: '0.08em' }}>
        {clockAt(beat)}
      </div>
      <div style={{ position: 'absolute', left: MARGIN * u, top: 9.6 * u, opacity: 1 - leaving }}>
        <Caption
          line={LINES[shot]}
          since={since}
          strike={times.strike === undefined ? undefined : times.strike - times.line}
          write={times.write === undefined ? undefined : times.write - times.line}
          right={times.right === undefined ? undefined : times.right - times.line}
          held={index === 0}
        />
      </div>
    </div>
  );
}
