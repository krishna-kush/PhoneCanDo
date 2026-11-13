package com.phonecando.runner.schedule

import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime

// When a timing comes due next: the first time strictly after a given one.
// A once has its one time; every N minutes is the grid from its anchor; a
// daily time is worked out in [zone] (the phone's, ZoneId.systemDefault())
// by java.time, so a time a DST change skips runs that much later that day
// (02:30 on a spring-forward night is 03:30) and one it repeats runs once,
// at its first. Missed grid times are never counted up: the next is the
// first after now. Pure.
object NextRun {
  /** The first time of [timing] after [after]; null for a once at or before it. */
  fun after(timing: Timing, after: Long, zone: ZoneId): Long? = when (timing) {
    is Timing.Once -> timing.at.takeIf { it > after }
    is Timing.Every -> every(timing, after)
    is Timing.Daily -> daily(timing, after, zone)
  }

  private fun every(t: Timing.Every, after: Long): Long {
    val period = t.minutes.coerceAtLeast(1) * ScheduleRules.MINUTE_MS
    if (t.anchor > after) return t.anchor
    val steps = (after - t.anchor) / period + 1
    return t.anchor + steps * period
  }

  private fun daily(t: Timing.Daily, after: Long, zone: ZoneId): Long {
    val time = LocalTime.of(t.minuteOfDay / 60, t.minuteOfDay % 60)
    val start = Instant.ofEpochMilli(after).atZone(zone).toLocalDate()
    // Today and the next 7 days hold every weekday once more.
    for (i in 0L..8L) {
      val date = start.plusDays(i)
      if (t.days.isNotEmpty() && date.dayOfWeek !in t.days) continue
      val at = ZonedDateTime.of(date, time, zone).toInstant().toEpochMilli()
      if (at > after) return at
    }
    error("no day in a week and a day")
  }
}
