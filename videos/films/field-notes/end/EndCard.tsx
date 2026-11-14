// The end: the site's first screen forms beside the phone, where the film
// hands over to it: the mark and name, the headline with its red italic
// verb, and the address as the button. A-01 pops up on the button and
// blinks.

import { lookOf } from '../../../brand/units/body.ts';
import { Unit } from '../../../brand/units/Unit.tsx';
import { outBack, outCubic } from '../../../engine/motion/ease.ts';
import { blinking } from '../../../engine/motion/eyes.ts';
import { hop } from '../../../engine/motion/squash.ts';
import { seg } from '../../../engine/motion/tween.ts';
import { At } from '../../../engine/stage/At.tsx';
import { useBeat } from '../../../engine/stage/Clock.tsx';
import { useStage } from '../../../engine/stage/useStage.ts';
import { MOMENTS } from '../script/moments.ts';

const HEADLINE = ['AI ', 'that ', 'can ', 'use ', 'your ', 'phone.'];
const VERB = 3;
const ADDRESS = 'phonecando.app';

/** The column's left edge and the mark's size, in u. */
const LEFT = 12;
const MARK = 7;

export function EndCard() {
  const beat = useBeat();
  const { u } = useStage();
  const m = MOMENTS.end;
  if (beat < m.mark - 0.1) return null;
  const mark = seg(beat, m.mark, m.mark + 0.3, outBack(2));
  const name = seg(beat, m.mark + 0.15, m.mark + 0.5, outCubic);
  const button = seg(beat, m.button, m.button + 0.25, outBack(2.6));
  const body = hop(beat, m.peek, 0.6, 1.1);
  const up = seg(beat, m.peek, m.peek + 0.3, outCubic);
  return (
    <>
      <At x={LEFT} y={12}>
        {/* The mark: the red block on its hard shadow, and the name. */}
        <div style={{ position: 'absolute', left: MARK * 0.12 * u, top: MARK * 0.12 * u, width: MARK * u, height: MARK * u, background: 'var(--accent)', transform: `scale(${mark})` }} />
        <div style={{ position: 'absolute', width: MARK * u, height: MARK * u, background: 'var(--red)', transform: `scale(${mark})` }} />
        <div style={{ position: 'absolute', left: (MARK + 2.6) * u, top: -0.6 * u, font: `600 ${7.2 * u}px/1.1 var(--sans)`, letterSpacing: '-0.03em', color: 'var(--fg)', opacity: name, whiteSpace: 'nowrap' }}>phonecando</div>
      </At>
      <At x={LEFT} y={26}>
        <div className="head" style={{ width: 84 * u }}>
          {HEADLINE.map((word, i) => {
            const k = seg(beat, m.headline + i * 0.14, m.headline + i * 0.14 + 0.32, outCubic);
            const style = { display: 'inline-block', whiteSpace: 'pre', opacity: k, transform: `translateY(${(1 - k) * 1.6 * u}px)` } as const;
            return i === VERB ? (
              <em key={word} style={style}>
                {word}
              </em>
            ) : (
              <span key={word} style={style}>
                {word}
              </span>
            );
          })}
        </div>
      </At>
      <At x={LEFT} y={55}>
        <div style={{ position: 'absolute', transformOrigin: '0 50%', transform: `scale(${button})`, opacity: Math.min(1, button * 2) }}>
          <div style={{ position: 'absolute', left: 0.9 * u, top: 0.9 * u, width: 58 * u, height: 9.6 * u, background: 'var(--accent)' }} />
          <div style={{ position: 'absolute', width: 58 * u, height: 9.6 * u, background: 'var(--red)', color: 'var(--on-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${3 * u}px`, font: `600 ${3.5 * u}px var(--mono)`, letterSpacing: '0.1em' }}>
            <span>{ADDRESS}</span>
            <span>→</span>
          </div>
        </div>
      </At>
      {/* A-01, up from behind the button. */}
      {beat >= m.peek ? (
        <At x={LEFT + 74} y={55 + 9.6 + (1 - up) * 8}>
          <Unit look={lookOf('plain')} size={12} lift={body.lift} sx={body.sx} sy={body.sy} eyes={blinking(beat, 5) || (beat >= m.blink && beat < m.blink + 0.22) ? 'shut' : 'dot'} gaze={[-0.6, 0]} shadow={0.14} />
        </At>
      ) : null}
    </>
  );
}
