package com.phonecando.runner.schedule

import java.time.ZoneId

// Which schedules are due at an alarm and what each comes to, before the
// agent is looked at: due when on with a nextAt at or before now; more than
// LATE_MAX late (the phone was off, the process dead) it is missed and not
// run; else it runs once, late when over LATE_MARK. Either way nextAt moves
// to the first time after now (none for a once), so a phone off for a week
// runs a daily task once, never seven times. Pure.
object DueRules {
  /** One due schedule: when it was due, whether it runs, whether late, and its next time. */
  data class Due(val schedule: Schedule, val dueAt: Long, val run: Boolean, val late: Boolean, val nextAt: Long?)

  fun due(schedules: List<Schedule>, now: Long, zone: ZoneId): List<Due> = schedules.mapNotNull { s ->
    val at = s.nextAt?.takeIf { s.on && it <= now } ?: return@mapNotNull null
    val late = now - at
    Due(
      schedule = s,
      dueAt = at,
      run = late <= ScheduleRules.LATE_MAX_MS,
      late = late > ScheduleRules.LATE_MARK_MS,
      nextAt = if (s.timing.repeats) NextRun.after(s.timing, maxOf(now, at), zone) else null,
    )
  }
}
