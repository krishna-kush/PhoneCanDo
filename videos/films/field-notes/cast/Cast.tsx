// The crew, drawn: every member at its pose for the beat (script.ts), the
// nearer ones over the farther. As each pops out in the crew shot its name
// tag flicks up over it for a moment.

import { Unit } from '../../../brand/units/Unit.tsx';
import { outBack } from '../../../engine/motion/ease.ts';
import { seg } from '../../../engine/motion/tween.ts';
import { At } from '../../../engine/stage/At.tsx';
import { MOMENTS } from '../script/moments.ts';
import { UNIT, WALL } from '../world/plan.ts';
import { poseAt } from './acts.ts';
import { CAST } from './cast.ts';
import { placeAt } from './moves.ts';
import { SCRIPT } from './script.ts';

/** How long a name tag stays up, in beats. */
const TAG = 1.6;

/** Out past a wall is out of sight. */
const inside = (x: number) => x > WALL.left + 2.5 && x < WALL.right - 2.5;

export function Cast({ beat }: { beat: number }) {
  const drawn = CAST.map((member) => {
    const part = SCRIPT.get(member.index);
    if (!part) return null;
    const pose = poseAt(beat, placeAt(beat, part.stations, UNIT), part.acts, member.look, member.index);
    return pose.shown && inside(pose.x) ? { member, pose } : null;
  })
    .filter((d) => d !== null)
    .sort((a, b) => a.pose.y - b.pose.y);

  return (
    <>
      {drawn.map(({ member, pose }) => {
        const popped = member.index > 0 ? MOMENTS.crew.pops[member.index - 1] : null;
        const tag = popped !== null && beat >= popped && beat < popped + TAG ? seg(beat, popped, popped + 0.3, outBack(2)) * (1 - seg(beat, popped + TAG - 0.3, popped + TAG)) : 0;
        return (
          <At key={member.index} x={pose.x} y={pose.y}>
            <Unit look={pose.look} size={UNIT} facing={pose.facing} toward={pose.toward} gaze={pose.gaze} eyes={pose.eyes} sx={pose.sx} sy={pose.sy} lift={pose.lift} lean={pose.lean} shadow={0.14} />
            {tag > 0 ? (
              <At y={-UNIT * 1.75} scale={tag}>
                <div
                  className="label fg"
                  style={{ position: 'absolute', transform: 'translate(-50%, -100%)', padding: 'calc(var(--u) * 0.35) calc(var(--u) * 0.8)', background: 'var(--bg)', border: 'calc(var(--u) * 0.16) solid var(--fg)', fontSize: 'calc(var(--u) * 1.55)' }}
                >
                  {member.name}
                </div>
              </At>
            ) : null}
          </At>
        );
      })}
    </>
  );
}
