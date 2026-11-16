import { useEffect, useRef, useState } from 'react';
import type { Look } from '../../../../../../../mascot/look.ts';
import { pickLook } from '../../../../../../../mascot/pick.ts';
import { useReduceMotion } from '../../../../common/useReduceMotion';
import { shuffleTimes } from '../logic/shuffle';

const TIMES = shuffleTimes();

// A shuffle under way: the look it started from, the look on the stage, and
// whether it has stopped on the pick.
type Run = { from: Look; preview: Look | null; landed: boolean };

// Surprise me as a shuffle on the stage: [pick] makes the pick at the tap,
// random looks flick past, slowing down (logic/shuffle.ts), the last of
// them the pick itself, and there it lands: `shuffling` goes false, on the
// stage alone. A step later [keep] keeps it, which redraws the whole page
// (the wardrobe follows) but changes nothing on the stage. With animations
// off it keeps the pick at once. The agent's look changing (a pick by
// hand, or this one kept) ends a shuffle in that same render.
export function useShuffle(look: Look, pick: () => Look, keep: (look: Look) => void) {
  const reduce = useReduceMotion();
  const [run, setRun] = useState<Run | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    [look],
  );
  const live = run?.from === look ? run : null;

  const start = () => {
    if (timers.current.length) return;
    const chosen = pick();
    if (reduce) {
      keep(chosen);
      return;
    }
    setRun({ from: look, preview: null, landed: false });
    const last = TIMES.shows.length - 1;
    timers.current = TIMES.shows.map((at, i) =>
      setTimeout(() => setRun((r) => r && { ...r, preview: i === last ? chosen : pickLook([], Math.random), landed: i === last }), at),
    );
    timers.current.push(
      setTimeout(() => {
        timers.current = [];
        keep(chosen);
      }, TIMES.lands),
    );
  };

  return { preview: live?.preview ?? null, shuffling: live != null && !live.landed, start };
}
