// A clock tests move by hand.

import type { Clock } from '../core/ports.ts';

/** A Clock that stands still until advanced. */
export interface FakeClock extends Clock {
  advance(ms: number): void;
  set(ms: number): void;
}

/** A FakeClock starting at `start` (ms). */
export function fakeClock(start = Date.UTC(2026, 10, 12, 12, 0, 0)): FakeClock {
  let t = start;
  return {
    now: () => t,
    advance: (ms) => {
      t += ms;
    },
    set: (ms) => {
      t = ms;
    },
  };
}
