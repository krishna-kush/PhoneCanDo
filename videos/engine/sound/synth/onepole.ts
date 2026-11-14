// A one-pole smoother: follows its input with a time constant, the
// simplest lowpass there is.

import { SR } from '../rate.ts';

export class OnePole {
  a: number;
  y = 0;

  /** Follows with time constant [seconds]. */
  constructor(seconds: number) {
    this.a = Math.exp(-1 / (seconds * SR));
  }

  run(x: number): number {
    this.y = x + (this.y - x) * this.a;
    if (this.y > -1e-20 && this.y < 1e-20) this.y = 0;
    return this.y;
  }
}
