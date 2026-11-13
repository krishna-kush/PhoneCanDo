package com.phonecando.runner.schedule

// Every number schedules hold to, in one place (DueRulesTest pins
// them). Pure.
object ScheduleRules {
  const val MINUTE_MS = 60_000L
  const val HOUR_MS = 60 * MINUTE_MS
  const val DAY_MS = 24 * HOUR_MS

  /** A task's text, after MessageText.clean. */
  const val MAX_TEXT = 4000

  /** Schedules one agent may have, whoever set them. */
  const val MAX_PER_AGENT = 20

  /** Of those, ones the agent set for itself. */
  const val MAX_BY_AGENT = 10

  /** The shortest repeat. */
  const val EVERY_MIN_MINUTES = 15

  /** A once at most this far ahead, and the longest repeat. */
  const val ONCE_MAX_AHEAD_DAYS = 366
  const val ONCE_MAX_AHEAD_MS = ONCE_MAX_AHEAD_DAYS * DAY_MS
  const val MAX_MINUTES = ONCE_MAX_AHEAD_DAYS * 24 * 60

  /** A firing waits this long past due for a busy agent, then is skipped (busy). */
  const val BUSY_WAIT_MS = 2 * HOUR_MS

  /** Due longer ago than this (the phone was off): missed, not run. */
  const val LATE_MAX_MS = 24 * HOUR_MS

  /** Due longer ago than this: it ran late (shown with the run). */
  const val LATE_MARK_MS = 2 * MINUTE_MS

  /** The runs log keeps the newest this many. */
  const val RUNS_KEPT = 200

  /** A run's text in the log: its first this many characters. */
  const val RUN_TEXT_MAX = 200

  /** A start decided outside an alarm (a wait that ended) goes through an alarm this soon. */
  const val START_ALARM_MS = 1_000L

  /** An agent we just asked to start counts as starting this long, until its engine says so. */
  const val STARTING_GRACE_MS = MINUTE_MS

  /** After a start of ours failed, the agent's other tasks fail this long rather than start it again. */
  const val FAILED_START_HOLD_MS = 10 * MINUTE_MS
}
