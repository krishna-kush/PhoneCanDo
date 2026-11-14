// A spring let go: 0 at the start, settling on 1, overshooting on the way
// when it is loose. The closed form, so any moment can be asked for on its
// own. Pure.

export type Spring = {
  /** How many times it would swing in one unit of time with no damping. */
  swings: number;
  /** 0 never settles, 1 settles without overshooting. */
  damping: number;
};

export const SOFT: Spring = { swings: 1.6, damping: 0.5 };
export const SNAPPY: Spring = { swings: 2.6, damping: 0.62 };
export const WOBBLY: Spring = { swings: 2.2, damping: 0.28 };

/** Where the spring is [t] after it was let go (0 before). */
export function spring(t: number, s: Spring = SNAPPY): number {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * s.swings;
  const z = Math.min(0.999, Math.max(0, s.damping));
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}

/** A knock at 0 that rings out: 0, a swing either way, back to 0. */
export function ring(t: number, s: Spring = WOBBLY): number {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * s.swings;
  const z = Math.min(0.999, Math.max(0, s.damping));
  return Math.exp(-z * w * t) * Math.sin(w * Math.sqrt(1 - z * z) * t);
}
