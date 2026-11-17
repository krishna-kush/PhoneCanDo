import { useEffect, useState } from 'react';
import type { SpotId } from '../../common/spot/ids';
import { spotMark, type SpotReach } from '../../common/spot/registry';
import { insideOf, sameRect, type Rect } from './logic/frame';

export type SpotRect = {
  /** Where the spot is in the window; null until it is on screen and laid out. */
  rect: Rect | null;
  reach?: SpotReach;
  /** It read the same twice running: it has stopped moving (a page or the drawer done sliding in). */
  still: boolean;
  /** It has stopped moving once since it came: from then on the pointer stays on it, following it if it shifts. */
  settled: boolean;
};

const EMPTY: SpotRect = { rect: null, still: false, settled: false };
/** How often the spot is read again while the guide shows it. */
const EVERY_MS = 120;
/** Reads a spot may miss (its view put back, its menu laid out again) before it counts as gone. */
const MISSES = 3;

// Where spot [id] is on screen, read again and again while the guide shows
// it, so the frame follows it as a page slides in, the drawer opens or the
// list scrolls. Only the one spot the guide points at is read. A miss or
// two keeps its last place, so a view put back doesn't make it blink.
export function useSpotRect(id: SpotId | null): SpotRect {
  const [state, setState] = useState<SpotRect>(EMPTY);

  useEffect(() => {
    setState(EMPTY);
    if (!id) return;
    let alive = true;
    let last: Rect | null = null;
    let settled = false;
    let missed = 0;
    const miss = () => {
      if (++missed <= MISSES) return;
      last = null;
      settled = false;
      setState((s) => (s.rect ? EMPTY : s));
    };
    const read = () => {
      const mark = spotMark(id);
      if (!mark) return miss();
      mark.node.measureInWindow((x, y, width, height) => {
        if (!alive) return;
        // A spot inside its view (a web page's button) sits where it last said.
        const at = mark.inner ? insideOf({ x, y, width, height }, mark.inner, mark.inner.across) : { x, y, width, height };
        if (at.width <= 0 || at.height <= 0) return miss();
        missed = 0;
        const still = last != null && sameRect(last, at);
        settled = settled || still;
        last = at;
        setState((s) =>
          s.still === still && s.settled === settled && s.reach === mark.reach && s.rect && sameRect(s.rect, at)
            ? s
            : { rect: at, reach: mark.reach, still, settled },
        );
      });
    };
    read();
    const timer = setInterval(read, EVERY_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id]);

  return state;
}
