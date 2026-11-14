// Easing curves, 0 to 1 in and (mostly) out. Pure; a picture's every move
// goes through one of these.

export type Ease = (t: number) => number;

export const linear: Ease = (t) => t;
export const inQuad: Ease = (t) => t * t;
export const outQuad: Ease = (t) => 1 - (1 - t) * (1 - t);
export const inOutQuad: Ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
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

/** Pulls back by [s] before it goes: the wind-up before a move. */
export const inBack =
  (s = 1.7): Ease =>
  (t) =>
    (s + 1) * t ** 3 - s * t ** 2;

/** Lands and bounces [bounces] times, each lower. */
export const outBounce =
  (bounces = 3, decay = 0.45): Ease =>
  (t) => {
    if (t >= 1) return 1;
    // The first fall takes half the time of a whole bounce; each bounce after is shorter by √decay.
    const r = Math.sqrt(decay);
    let total = 0.5;
    for (let i = 1; i <= bounces; i++) total += r ** i;
    let at = t * total;
    if (at < 0.5) return (at / 0.5) ** 2;
    at -= 0.5;
    for (let i = 1; i <= bounces; i++) {
      const len = r ** i;
      if (at < len) {
        const k = at / len;
        return 1 - decay ** i * 4 * k * (1 - k);
      }
      at -= len;
    }
    return 1;
  };
