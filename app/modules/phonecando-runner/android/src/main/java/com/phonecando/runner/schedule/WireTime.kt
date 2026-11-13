package com.phonecando.runner.schedule

import java.time.DayOfWeek
import java.util.Locale

// The wire's clock times and day names, both ways: "HH:MM" (00:00..23:59)
// as a minute of the day, and "mon".."sun" as days of the week. What the
// store, JS and the schedule_* tools all use. Pure.
object WireTime {
  private val WIRE = DayOfWeek.entries.associateWith { it.name.take(3).lowercase(Locale.ROOT) }
  private val BY_WIRE = WIRE.entries.associate { (day, wire) -> wire to day }
  private val CLOCK = Regex("""(\d{1,2}):(\d{2})""")

  /** The minute of the day for "9:05" or "09:05"; null for anything else. */
  fun minuteOfDay(text: String): Int? {
    val m = CLOCK.matchEntire(text.trim()) ?: return null
    val h = m.groupValues[1].toInt()
    val min = m.groupValues[2].toInt()
    if (h > 23 || min > 59) return null
    return h * 60 + min
  }

  /** "09:05" for 545. */
  fun clock(minuteOfDay: Int): String = TimingText.clock(minuteOfDay)

  fun day(day: DayOfWeek): String = WIRE.getValue(day)

  /** The day for "mon".."sun" (any case); null for anything else. */
  fun dayOf(wire: String): DayOfWeek? = BY_WIRE[wire.trim().lowercase(Locale.ROOT)]

  /** "Mon". */
  fun short(day: DayOfWeek): String = day(day).replaceFirstChar { it.uppercaseChar() }
}
