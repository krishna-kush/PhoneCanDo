// The runner's schedule rules the editor checks before it saves, so a
// problem shows under its field (runner/schedule/ScheduleRules.kt is the
// one place they are kept; the runner checks again). Pure (zero RN
// imports).

/** The longest task, in characters. */
export const MAX_TEXT = 4000;

/** The shortest interval for a repeating one. */
export const EVERY_MIN_MINUTES = 15;

/** How far ahead a one-off may be. */
export const ONCE_MAX_AHEAD_DAYS = 366;

/** The longest interval the editor takes (a year, as a one-off's reach). */
export const EVERY_MAX_MINUTES = ONCE_MAX_AHEAD_DAYS * 24 * 60;
