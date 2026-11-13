package com.phonecando.runner.schedule

import java.time.DayOfWeek
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

// A timing and a time as plain English for the model (the task's label, the
// schedule_* replies): "once at 2026-11-14 09:00", "every 30 min", "every
// 2 h 30 min", "daily at 09:00", "Mon, Wed, Fri at 09:00", and times as
// ISO-8601 with the phone's offset. The app words timings itself
// (ui/schedule/logic). Pure.
object TimingText {
  fun of(timing: Timing, zone: ZoneId): String = when (timing) {
    is Timing.Once -> "once at " + LOCAL.format(Instant.ofEpochMilli(timing.at).atZone(zone))
    is Timing.Every -> "every " + span(timing.minutes)
    is Timing.Daily -> {
      val time = clock(timing.minuteOfDay)
      if (timing.days.isEmpty() || timing.days.size == 7) "daily at $time" else "${days(timing.days)} at $time"
    }
  }

  /** "2 h 30 min", "15 min", "3 days". */
  fun span(minutes: Int): String {
    if (minutes >= DAY_MINUTES && minutes % DAY_MINUTES == 0) {
      val d = minutes / DAY_MINUTES
      return if (d == 1) "1 day" else "$d days"
    }
    val h = minutes / 60
    val m = minutes % 60
    return when {
      h == 0 -> "$m min"
      m == 0 -> "$h h"
      else -> "$h h $m min"
    }
  }

  /** "09:05" for 545. */
  fun clock(minuteOfDay: Int): String = "%02d:%02d".format(Locale.ROOT, minuteOfDay / 60, minuteOfDay % 60)

  /** Epoch ms as ISO-8601 with [zone]'s offset, to the second: "2026-11-14T09:00:00+01:00". */
  fun iso(ms: Long, zone: ZoneId): String =
    DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(Instant.ofEpochMilli(ms).atZone(zone).withNano(0).toOffsetDateTime())

  /** "Mon, Wed, Fri" in week order. */
  fun days(days: Set<DayOfWeek>): String = days.sorted().joinToString(", ") { WireTime.short(it) }

  private const val DAY_MINUTES = 24 * 60
  private val LOCAL: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm", Locale.ROOT)
}
