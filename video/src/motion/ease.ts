// Easing curves, 0 to 1 in and (mostly) out. Pure; the picture's every
// move goes through one of these.

export type Ease = (t: number) => number;

export const linear: Ease = (t) => t;
export const inQuad: Ease = (t) => t * t;
export const inCubic: Ease = (t) => t * t * t;
export const outCubic: Ease = (t) => 1 - (1 - t) ** 3;
export const inOutCubic: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const outExpo: Ease = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
export const inExpo: Ease = (t) => (t <= 0 ? 0 : 2 ** (10 * t - 10));

/** Past the end and back, by [s] (1.7 is the classic). */
export const outBack =
  (s = 1.7): Ease =>
  (t) =>
    1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;
