// Hard silence over [from, to) samples, faded out just before it so it
// never starts on a click. What follows starts from nothing on its own.

import { SR } from '../rate.ts';
import type { Stereo } from '../synth/stereo.ts';

const FADE = Math.round(0.003 * SR);

export function silence(s: Stereo, from: number, to: number) {
  for (let i = Math.max(0, from - FADE); i < from; i++) {
    const g = (from - i) / FADE;
    s.l[i] *= g;
    s.r[i] *= g;
  }
  s.l.fill(0, from, to);
  s.r.fill(0, from, to);
}
