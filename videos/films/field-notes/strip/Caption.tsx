// One of the narrator's lines on the strip, and its fixing: a small unit
// runs along under the wrong words and a red line goes through them, then the right ones drop in
// after them in the site's red italic and the rest of the sentence makes
// room. A line he gets right is ticked instead.

import { lookOf } from '../../../brand/units/body.ts';
import { Unit } from '../../../brand/units/Unit.tsx';
import { outBack, outBounce, outCubic } from '../../../engine/motion/ease.ts';
import { hop } from '../../../engine/motion/squash.ts';
import { seg } from '../../../engine/motion/tween.ts';
import { useStage } from '../../../engine/stage/useStage.ts';
import { partsOf, type NarratorLine } from '../script/lines.ts';

/** The line's size, in u. */
export const TYPE = 6.4;

/** How long the red line takes to cross the words, in beats. */
const STRIKE = 0.6;

/** The one who does the fixing, and how far under the line it runs, so it never hides a word. */
const FIXER = lookOf('reader');
const FIXER_SIZE = 5.6;
const UNDER = 7.5;

export type CaptionProps = {
  line: NarratorLine;
  /** Beats since the line came up. */
  since: number;
  /** When the words are struck and the fix written, in beats since the line came up; when the tick lands. */
  strike?: number;
  write?: number;
  right?: number;
  /** Whether the line is there from the first frame, rather than coming up word by word. */
  held?: boolean;
};

export function Caption({ line, since, strike, write, right, held }: CaptionProps) {
  const { u } = useStage();
  const { before, struck, after } = partsOf(line);
  const words = before.split(/(?<= )/);
  const struckK = strike === undefined ? 0 : seg(since, strike, strike + STRIKE);
  const grown = write === undefined ? 0 : seg(since, write - 0.2, write, outCubic);
  const landed = write === undefined ? 0 : seg(since, write - 0.2, write + 0.5, outBounce(2, 0.3));
  // The fixer comes up at the first struck letter, runs the line across, hops as the fix lands, and goes.
  const fixer = strike === undefined || write === undefined ? 0 : seg(since, strike - 0.25, strike, outBack(2)) * (1 - seg(since, write + 1.4, write + 1.7));
  const jump = write === undefined ? { lift: 0, sx: 1, sy: 1 } : hop(since, write - 0.1, 0.45, 0.7);

  return (
    <div style={{ fontFamily: 'var(--serif)', fontSize: TYPE * u, lineHeight: 1, color: 'var(--fg)', whiteSpace: 'nowrap', letterSpacing: '-0.012em' }}>
      {words.map((word, i) => {
        const k = held ? 1 : seg(since, i * 0.09, i * 0.09 + 0.3, outCubic);
        return (
          <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre', opacity: k, transform: `translateY(${(1 - k) * 1.2 * u}px)` }}>
            {word}
          </span>
        );
      })}
      {struck ? (
        <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'pre', opacity: held ? 1 : seg(since, words.length * 0.09, words.length * 0.09 + 0.3, outCubic), color: struckK >= 1 ? 'var(--faint)' : undefined }}>
          {struck}
          <span style={{ position: 'absolute', left: '-3%', top: '56%', width: `${struckK * 106}%`, height: 0.55 * u, background: 'var(--red)' }} />
          {fixer > 0 ? (
            <span style={{ position: 'absolute', left: `${struckK * 100}%`, top: '100%', marginTop: UNDER * u, transform: `scale(${fixer})` }}>
              <Unit look={FIXER} size={FIXER_SIZE} facing={struckK > 0 && struckK < 1 ? 'side' : 'front'} toward={1} gaze={[0.4, -0.8]} lift={jump.lift + (struckK > 0 && struckK < 1 ? 0.14 * Math.abs(Math.sin(struckK * Math.PI * 3)) : 0)} sx={jump.sx} sy={jump.sy} shadow={0} />
            </span>
          ) : null}
        </span>
      ) : null}
      {line.fix ? (
        <span style={{ position: 'relative', display: 'inline-block', verticalAlign: 'top' }}>
          {/* What makes room in the sentence, and over it what is seen dropping in. */}
          <span style={{ display: 'inline-block', overflow: 'hidden', maxWidth: grown >= 1 ? undefined : grown * 70 * u, visibility: 'hidden', whiteSpace: 'pre', fontStyle: 'italic', verticalAlign: 'top' }}> {line.fix}</span>
          <span style={{ position: 'absolute', left: 0, top: 0, whiteSpace: 'pre', fontStyle: 'italic', color: 'var(--red)', opacity: grown, transform: `translateY(${-(1 - landed) * 16 * u}px)` }}> {line.fix}</span>
        </span>
      ) : null}
      <span style={{ display: 'inline-block', whiteSpace: 'pre', opacity: held ? 1 : seg(since, (words.length + 1) * 0.09, (words.length + 1) * 0.09 + 0.3, outCubic) }}>{after}</span>
      {line.right && right !== undefined ? (
        <span style={{ display: 'inline-block', marginLeft: 1.6 * u, fontFamily: 'var(--sans)', fontWeight: 700, color: 'var(--red)', transform: `scale(${seg(since, right, right + 0.25, outBack(2.6))})` }}>✓</span>
      ) : null}
    </div>
  );
}
