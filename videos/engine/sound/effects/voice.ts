// A tiny robot's voice: a few FM bleeps that rise and fall like speech.
// Each cue's seed picks what it says.

import { SR } from '../rate.ts';
import { Biquad } from '../synth/biquad.ts';
import { gate } from '../synth/env.ts';
import { Osc } from '../synth/osc.ts';
import { hz } from '../synth/pitch.ts';
import { dual } from '../synth/stereo.ts';
import type { Effect } from './types.ts';

/** One bleep: the note it starts and ends on (MIDI), how long, the pause after, how much it warbles. */
type Syllable = { from: number; to: number; dur: number; gap?: number; vib?: number };

const PHRASES: readonly (readonly Syllable[])[] = [
  // 0, "hm?": one note, rising, curious.
  [{ from: 76, to: 81, dur: 0.24, vib: 0.3 }],
  // 1, "hi!": two notes, up.
  [
    { from: 84, to: 84, dur: 0.07, gap: 0.03 },
    { from: 88, to: 91, dur: 0.13 },
  ],
  // 2, "wanna see?": three notes rising, the last one asking.
  [
    { from: 81, to: 81, dur: 0.06, gap: 0.025 },
    { from: 84, to: 84, dur: 0.06, gap: 0.025 },
    { from: 88, to: 93, dur: 0.15 },
  ],
  // 3, "yep": down, then up.
  [
    { from: 88, to: 84, dur: 0.07, gap: 0.03 },
    { from: 84, to: 91, dur: 0.1 },
  ],
  // 4, sad: falling, slow.
  [
    { from: 81, to: 77, dur: 0.14, gap: 0.03 },
    { from: 77, to: 74, dur: 0.14, gap: 0.03 },
    { from: 74, to: 69, dur: 0.26, vib: 0.5 },
  ],
  // 5, "bye!": bright, three notes.
  [
    { from: 84, to: 84, dur: 0.06, gap: 0.02 },
    { from: 88, to: 88, dur: 0.06, gap: 0.02 },
    { from: 91, to: 96, dur: 0.17, vib: 0.4 },
  ],
];

export const chirp: Effect = ({ pitch, seed }) => {
  const phrase = PHRASES[((seed % PHRASES.length) + PHRASES.length) % PHRASES.length];
  const long = phrase.reduce((s, x) => s + x.dur + (x.gap ?? 0), 0) + 0.03;
  const out = new Float32Array(Math.round(long * SR));
  const lp = new Biquad().set('lp', 6500, 0.7);
  const square = new Osc();
  let c = 0;
  let m = 0;
  let at = 0;
  for (const s of phrase) {
    const n = Math.round((s.dur + 0.015) * SR);
    const start = Math.round(at * SR);
    for (let i = 0; i < n && start + i < out.length; i++) {
      const t = i / SR;
      const u = Math.min(1, t / s.dur);
      const note = s.from + (s.to - s.from) * u ** 0.7 + (s.vib ?? 0.15) * Math.sin(2 * Math.PI * 28 * t) + pitch;
      const f = hz(note);
      const index = 1.6 * (0.6 + 0.4 * Math.exp(-t / 0.03));
      const v = Math.sin(2 * Math.PI * c + index * Math.sin(2 * Math.PI * m)) * 0.8 + square.pulse(f, 0.25) * 0.15;
      c = (c + f / SR) % 1;
      m = (m + f / SR) % 1;
      out[start + i] += v * gate(t, s.dur, 0.006, 0.015);
    }
    at += s.dur + (s.gap ?? 0);
  }
  for (let i = 0; i < out.length; i++) out[i] = lp.run(out[i]);
  return dual(out);
};
