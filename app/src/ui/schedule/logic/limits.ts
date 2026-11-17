// The runner's schedule rules the editor checks before it saves, so a
// problem shows under its field (runner/schedule/ScheduleRules.kt is the
// one place they are kept; the runner checks again), and the timing ones
// "How schedules run" tells. Pure (zero RN imports).

/** The longest task, in characters. */
export const MAX_TEXT = 4000;

/** The shortest interval for a repeating one. */
export const EVERY_MIN_MINUTES = 15;

/** How far ahead a one-off may be. */
export const ONCE_MAX_AHEAD_DAYS = 366;

/** The longest interval the editor takes (a year, as a one-off's reach). */
export const EVERY_MAX_MINUTES = ONCE_MAX_AHEAD_DAYS * 24 * 60;

// The runner's timing rules, as "How schedules run" tells them.

/** A due task waits this long for a busy agent, then is skipped as busy. */
export const BUSY_WAIT_MS = 2 * 60 * 60_000;

/** A task this late (the phone was off, PhoneCanDo wasn't running) is missed, not run. */
export const LATE_MAX_MS = 24 * 60 * 60_000;

/** A task run this late is marked late in its run. */
export const LATE_MARK_MS = 2 * 60_000;
