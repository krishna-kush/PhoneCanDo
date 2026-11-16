// The drag's numbers, for the drawer's agent rows: how long a hold lifts a
// row, how far a finger may stray before a hold counts as a drag, and the
// slot a dragged row lands in. Pure (zero RN imports); dropSlot runs on the
// UI thread, every frame of a drag.

/** How long a finger holds a row before it lifts (Android's long press). */
export const HOLD_MS = 400;
/** A lifted row moved less than this, then let go, was a long press, not a drag. */
export const HOLD_SLOP = 8;
/** The room between two rows. */
export const ROW_GAP = 4;

/** The slot a row lifted from `from` lands in, dragged `dy` with rows `slot` apart. */
export function dropSlot(from: number, dy: number, slot: number, count: number): number {
  'worklet';
  if (count < 1 || slot <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(from + dy / slot)));
}

/** The list's height for `count` rows of `rowH`. */
export function listHeight(count: number, rowH: number): number {
  return count < 1 ? 0 : count * rowH + (count - 1) * ROW_GAP;
}
