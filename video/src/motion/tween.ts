// Time into amounts: how far through a stretch of beats we are, eased, and
// what lies between two values. Pure.

import { linear, type Ease } from './ease.ts';

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** How far [t] is through [from, to], 0 to 1, eased. */
export const seg = (t: number, from: number, to: number, ease: Ease = linear) =>
  ease(clamp(to === from ? (t >= to ? 1 : 0) : (t - from) / (to - from)));

/** [a] to [b] as [t] runs through [from, to], eased. */
export const tween = (t: number, from: number, to: number, a: number, b: number, ease: Ease = linear) => lerp(a, b, seg(t, from, to, ease));

/** A hit on each beat, falling away as e^-k: 1 on the beat, near 0 by the next. */
export const pulse = (beat: number, k = 6) => (beat < 0 ? 0 : Math.exp(-k * (beat - Math.floor(beat))));

/** A hit at [at] falling away as e^-k per beat; 0 before it. */
export const hit = (t: number, at: number, k = 5) => (t < at ? 0 : Math.exp(-k * (t - at)));
