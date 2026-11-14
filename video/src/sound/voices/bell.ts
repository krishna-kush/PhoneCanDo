// An FM bell: one sine bending another. A modulator at 3.5 times the note
// rings glassy, a music box; at 2 it is a clean chime.

import { SR } from '../rate.ts';
import { tail } from '../synth/env.ts';

export type Bell = {
  freq: number;
  /** The modulator's frequency, as a multiple of the note's. */
  ratio?: number;
  /** How hard the modulator bends the note at the strike. */
  index?: number;
  /** How fast that bend fades, in seconds: the strike's brightness. */
  bright?: number;
  /** How fast the note dies away, in seconds. */
  decay?: number;
};

export function bell({ freq, ratio = 3.5, index = 2.2, bright = 0.12, decay = 0.5 }: Bell): Float32Array {
  const n = Math.round(SR * (decay * 5 + 0.01));
  const out = new Float32Array(n);
  const fade = Math.round(0.005 * SR);
  let c = 0;
  let m = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const bend = Math.sin(2 * Math.PI * m) * index * Math.exp(-t / bright);
    const amp = (t < 0.0015 ? t / 0.0015 : 1) * Math.exp(-t / decay) * tail(i, n, fade);
    out[i] = Math.sin(2 * Math.PI * c + bend) * amp;
    c = (c + freq / SR) % 1;
    m = (m + (freq * ratio) / SR) % 1;
  }
  return out;
}
