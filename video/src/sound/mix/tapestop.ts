// A tape stop: the music read at a speed falling from 1 to 0 over [len]
// samples, so it slows and sinks in pitch to nothing, the way a deck
// sounds when its motor is cut.

import type { Stereo } from '../synth/stereo.ts';

export function tapeStop(s: Stereo, at: number, len: number) {
  const end = Math.min(s.l.length, at + len);
  const l = s.l.slice(at, end);
  const r = s.r.slice(at, end);
  for (let k = 0; k < end - at; k++) {
    const u = k / len;
    // How far the tape has moved by now: the speed's integral.
    const pos = len * (u - (u * u) / 2);
    const i = Math.floor(pos);
    const f = pos - i;
    const j = Math.min(i + 1, l.length - 1);
    const fade = (1 - u) ** 0.6;
    s.l[at + k] = (l[i] * (1 - f) + l[j] * f) * fade;
    s.r[at + k] = (r[i] * (1 - f) + r[j] * f) * fade;
  }
}
