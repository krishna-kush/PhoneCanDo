// Motion as pure functions of time: a scene asks where a unit is at t, so a
// loop keeps no state and reduced motion is only a frozen t.

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** How far through a loop of [period] seconds t is, 0 to 1. */
export const phase = (t: number, period: number, offset = 0) =>
  ((((t + offset) % period) + period) % period) / period;

/** p mapped onto [a, b] and held at its ends: a beat inside a loop. */
export const span = (p: number, a: number, b: number) => clamp((p - a) / (b - a), 0, 1);

export const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
export const easeOut = (p: number) => 1 - (1 - p) ** 3;
export const easeIn = (p: number) => p * p * p;
/** Up and back down again: 0 at both ends, 1 in the middle. */
export const arch = (p: number) => Math.sin(Math.PI * clamp(p, 0, 1));

export type Jump = { lift: number; sx: number; sy: number };
export const STILL: Jump = { lift: 0, sx: 1, sy: 1 };

/** One hop over p 0 to 1: a crouch, a stretched flight [height] high, a squashed landing. */
export function jump(p: number, height: number): Jump {
  if (p <= 0 || p >= 1) return STILL;
  if (p < 0.15) {
    const k = arch(p / 0.15 / 2);
    return { lift: 0, sx: 1 + 0.16 * k, sy: 1 - 0.16 * k };
  }
  if (p < 0.85) {
    const q = (p - 0.15) / 0.7;
    return { lift: height * arch(q), sx: 1 - 0.1 * (1 - q), sy: 1 + 0.14 * (1 - q) };
  }
  const k = arch((p - 0.85) / 0.15);
  return { lift: 0, sx: 1 + 0.2 * k, sy: 1 - 0.2 * k };
}

/** A walk's little hops: [walked] is distance or time covered. */
export const stepLift = (walked: number, height = 3) => Math.abs(Math.sin(walked * 0.22)) * height;

/** Breathing, a slow squash that never quite stops. */
export function breathe(t: number, seed: number, depth = 0.03): Jump {
  const k = Math.sin((t * 0.55 + seed) * Math.PI * 2) * depth;
  return { lift: 0, sx: 1 - k * 0.6, sy: 1 + k };
}

/** Whether the eyes are shut for a blink, once every few seconds each. */
export const blinking = (t: number, seed: number) => (t + seed * 11) % (3.2 + seed * 2.4) < 0.13;
