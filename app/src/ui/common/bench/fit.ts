// How a bench of places fits its row: evenly across it while each place
// keeps room for what sits on it and its number, else at a set width,
// scrolling sideways, with the picked place in the middle. Pure (zero RN
// imports).

/** The gap between two places. */
export const GAP = 2;
/** The hairline after the first place (no cap, Auto). */
export const DIVIDER = 1;
/** The narrowest a place gets on an even bench. */
const MIN_PLACE = 34;
/** A place's width on a bench that scrolls. */
export const CROWDED_PLACE = 40;

/** A place's set width when `count` places would be narrower than MIN_PLACE across `width`; null when they fit (or `width` is not known yet). */
export function crowdedWidth(count: number, width: number): number | null {
  if (width <= 0 || count <= 0) return null;
  const room = width - DIVIDER - GAP * count;
  return room / count >= MIN_PLACE ? null : CROWDED_PLACE;
}

/** Where a crowded bench scrolls to so place `at` (the first is 0) sits in the middle of `width`. */
export function scrollFor(at: number, place: number, width: number): number {
  const middle = at * (place + GAP) + (at > 0 ? DIVIDER + GAP : 0) + place / 2;
  return Math.max(0, middle - width / 2);
}
