import { useCallback, useEffect, useRef, useState } from 'react';
import type { Look } from '../../../../../../../mascot/look.ts';
import { pickLook } from '../../../../../../../mascot/pick.ts';
import { useReduceMotion } from '../../../../common/useReduceMotion';
import { shuffleTimes } from '../logic/shuffle';

const TIMES = shuffleTimes();

// Surprise me as a shuffle: random looks flick past on the stage, slowing
// down (logic/shuffle.ts), then [land] makes the real pick. With animations
// off it lands at once. `stop` drops a shuffle under way (a pick by hand).
export function useShuffle(land: () => void) {
  const reduce = useReduceMotion();
  const [preview, setPreview] = useState<Look | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const stop = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPreview(null);
  }, []);
  useEffect(() => stop, [stop]);

  const start = () => {
    if (timers.current.length) return;
    if (reduce) {
      land();
      return;
    }
    timers.current = TIMES.shows.map((at) => setTimeout(() => setPreview(pickLook([], Math.random)), at));
    timers.current.push(
      setTimeout(() => {
        timers.current = [];
        setPreview(null);
        land();
      }, TIMES.lands),
    );
  };

  return { preview, start, stop };
}
