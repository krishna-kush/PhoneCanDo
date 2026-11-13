// The moon and the sun over the roll's sky (NightRoll.astro), at a minute
// of the night. The moon is just up as the night starts, highest after
// one, and sets after dawn; the sun comes up at 06:00, so for a while at
// dawn both are up. Each as how high it is (0 on the horizon, 1 at the top)
// and how far it leans. Pure.

import { NIGHT } from './night';

/** 20:00: a little up already at 21:00. */
const MOONRISE = -60;
/** 06:30. */
const MOONSET = 570;
/** 06:00. */
export const SUNRISE = 540;
/** How high the sun gets by 09:00. */
const SUN_TOP = 0.8;

export type Body = { up: number; lean: number };

const clamp = (k: number) => Math.max(0, Math.min(1, k));

export function moonAt(t: number): Body {
  const k = (t - MOONRISE) / (MOONSET - MOONRISE);
  return { up: k > 0 && k < 1 ? Math.sin(Math.PI * k) : 0, lean: -30 + 60 * clamp(k) };
}

export function sunAt(t: number): Body {
  const k = clamp((t - SUNRISE) / (NIGHT - SUNRISE));
  return { up: SUN_TOP * Math.sin((Math.PI / 2) * k), lean: 90 * k };
}
