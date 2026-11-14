// Mastering: no DC, the lows in the middle, the whole brought to the
// platforms' loudness (-14 LUFS), its loudest moments rounded by a soft
// knee and its true peak held under the ceiling; a breath of fade at each
// end.

import { SR } from '../rate.ts';
import { Biquad } from '../synth/biquad.ts';
import { soft } from '../synth/shape.ts';
import type { Stereo } from '../synth/stereo.ts';
import { limit } from './limiter.ts';
import { integrated } from './loudness.ts';
import { truePeak } from './truepeak.ts';

/** Below this the sides are folded into the middle, so the bass and kick stay mono. */
const MONO_BELOW = 150;
/** Where the soft knee starts bending, linear. */
const KNEE = 0.6;

/**
 * No DC, nothing but the middle below MONO_BELOW, and a gentle tilt: a
 * little less sub, a little more presence, so it still reads on a phone's
 * speaker where most of these videos will play. In place.
 */
export function clean(s: Stereo) {
  const chain = () => [new Biquad().set('hp', 20, 0.7), new Biquad().set('lowshelf', 90, 0.7, -2), new Biquad().set('highshelf', 1800, 0.6, 2.5)];
  const left = chain();
  const right = chain();
  const side = new Biquad().set('hp', MONO_BELOW, 0.7);
  for (let i = 0; i < s.l.length; i++) {
    let l = s.l[i];
    let r = s.r[i];
    for (let k = 0; k < left.length; k++) {
      l = left[k].run(l);
      r = right[k].run(r);
    }
    const m = (l + r) / 2;
    const d = side.run((l - r) / 2);
    s.l[i] = m + d;
    s.r[i] = m - d;
  }
}

export type Mastered = { out: Stereo; gain: number; lufs: number; peak: number };

/** [mix] mastered to [target] LUFS with its true peak under [ceilingDb]; [mix] itself is left as it was. */
export function master(mix: Stereo, target: number, ceilingDb: number): Mastered {
  const ceiling = 10 ** (ceilingDb / 20);
  let gain = 10 ** ((target - integrated(mix)) / 20);
  let out: Stereo = mix;
  let lufs = -Infinity;
  for (let k = 0; k < 6; k++) {
    out = { l: new Float32Array(mix.l.length), r: new Float32Array(mix.r.length) };
    for (let i = 0; i < mix.l.length; i++) {
      out.l[i] = soft(mix.l[i] * gain, KNEE);
      out.r[i] = soft(mix.r[i] * gain, KNEE);
    }
    limit(out, ceiling);
    lufs = integrated(out);
    if (Math.abs(lufs - target) <= 0.1) break;
    gain *= 10 ** ((target - lufs) / 20);
  }
  fadeEnds(out);
  let peak = truePeak(out);
  if (peak > ceiling) {
    const g = ceiling / peak;
    for (let i = 0; i < out.l.length; i++) {
      out.l[i] *= g;
      out.r[i] *= g;
    }
    peak = truePeak(out);
    lufs = integrated(out);
  }
  return { out, gain, lufs, peak };
}

/** In over the first 5 ms, out over the last 0.3 s. */
function fadeEnds(s: Stereo) {
  const n = s.l.length;
  const a = Math.round(0.005 * SR);
  const z = Math.round(0.3 * SR);
  for (let i = 0; i < Math.min(a, n); i++) {
    s.l[i] *= i / a;
    s.r[i] *= i / a;
  }
  for (let i = Math.max(0, n - z); i < n; i++) {
    const g = ((n - 1 - i) / z) ** 2;
    s.l[i] *= g;
    s.r[i] *= g;
  }
}
