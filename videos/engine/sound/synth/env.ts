// Envelopes as plain functions of time, in seconds.

/** Rises in a straight line over [a], then falls away with time constant [tau]. */
export const ad = (t: number, a: number, tau: number) => (t < 0 ? 0 : t < a ? t / a : Math.exp(-(t - a) / tau));

/** Up over [a], held until [len], down over [r]. */
export function gate(t: number, len: number, a: number, r: number): number {
  if (t < 0) return 0;
  const up = t < a ? t / a : 1;
  const down = t < len ? 1 : Math.max(0, 1 - (t - len) / r);
  return up * down;
}

export const clamp01 = (u: number) => (u < 0 ? 0 : u > 1 ? 1 : u);

/** An S-curve from 0 to 1 as [u] goes from 0 to 1. */
export const smooth = (u: number) => {
  const x = clamp01(u);
  return x * x * (3 - 2 * x);
};

/** 1 until the last [fade] samples of [n], then down to 0, so a buffer never ends on a click. */
export const tail = (i: number, n: number, fade: number) => (i < n - fade ? 1 : Math.max(0, (n - i) / fade));
