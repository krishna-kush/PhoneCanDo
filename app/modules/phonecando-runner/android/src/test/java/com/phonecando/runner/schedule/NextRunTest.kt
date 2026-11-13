package com.phonecando.runner.schedule

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.DayOfWeek
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZonedDateTime

// When a timing comes due next: a once's one time, the every grid from its
// anchor, daily times on their days and across both DST changes.
class NextRunTest {
  private val berlin = ZoneId.of("Europe/Berlin")

  private fun at(text: String, zone: ZoneId = berlin): Long = LocalDateTime.parse(text).atZone(zone).toInstant().toEpochMilli()

  private fun local(ms: Long, zone: ZoneId = berlin): ZonedDateTime = java.time.Instant.ofEpochMilli(ms).atZone(zone)

  @Test fun aOnceHasItsTimeUntilItPasses() {
    val t = Timing.Once(at("2026-11-14T09:00"))
    assertEquals(t.at, NextRun.after(t, at("2026-11-13T12:00"), berlin))
    assertNull(NextRun.after(t, t.at, berlin))
    assertNull(NextRun.after(t, t.at + 1, berlin))
  }

  @Test fun everyStepsOnTheGridFromItsAnchorAndSkipsMissedOnes() {
    val anchor = at("2026-11-13T10:00")
    val t = Timing.Every(30, anchor)
    // The first run is a period after the anchor when set at the anchor.
    assertEquals(at("2026-11-13T10:30"), NextRun.after(t, anchor, berlin))
    // An anchor ahead is the first run.
    assertEquals(anchor, NextRun.after(t, anchor - 5 * 60_000, berlin))
    // Just before and on a grid time.
    assertEquals(at("2026-11-13T11:00"), NextRun.after(t, at("2026-11-13T10:59"), berlin))
    assertEquals(at("2026-11-13T11:30"), NextRun.after(t, at("2026-11-13T11:00"), berlin))
    // A phone off for a day: the next grid time after now, not the missed ones.
    assertEquals(at("2026-11-14T10:30"), NextRun.after(t, at("2026-11-14T10:12"), berlin))
  }

  @Test fun dailyIsTodayIfStillAheadElseTomorrow() {
    val t = Timing.Daily(9 * 60, emptySet())
    assertEquals(at("2026-11-13T09:00"), NextRun.after(t, at("2026-11-13T08:59"), berlin))
    assertEquals(at("2026-11-14T09:00"), NextRun.after(t, at("2026-11-13T09:00"), berlin))
    assertEquals(at("2026-11-14T09:00"), NextRun.after(t, at("2026-11-13T23:00"), berlin))
  }

  @Test fun dailyKeepsToItsDays() {
    // 2026-11-13 is a Friday.
    val t = Timing.Daily(8 * 60 + 30, setOf(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY))
    val next = NextRun.after(t, at("2026-11-13T07:00"), berlin)!!
    assertEquals(at("2026-11-16T08:30"), next)
    assertEquals(DayOfWeek.MONDAY, local(next).dayOfWeek)
    assertEquals(at("2026-11-18T08:30"), NextRun.after(t, next, berlin))
    // The same weekday a week on.
    val sunday = Timing.Daily(12 * 60, setOf(DayOfWeek.FRIDAY))
    assertEquals(at("2026-11-20T12:00"), NextRun.after(sunday, at("2026-11-13T12:00"), berlin))
  }

  @Test fun aTimeTheSpringChangeSkipsRunsThatMuchLater() {
    // 2026-03-29: Berlin goes from 02:00 to 03:00.
    val t = Timing.Daily(2 * 60 + 30, emptySet())
    val next = NextRun.after(t, at("2026-03-29T01:00"), berlin)!!
    assertEquals(3, local(next).hour)
    assertEquals(30, local(next).minute)
    assertEquals(29, local(next).dayOfMonth)
    // The day after, 02:30 again, 23 h later.
    val after = NextRun.after(t, next, berlin)!!
    assertEquals(at("2026-03-30T02:30"), after)
    assertEquals(23L * 3_600_000, after - next)
  }

  @Test fun aTimeTheAutumnChangeRepeatsRunsOnce() {
    // 2026-10-25: Berlin goes from 03:00 back to 02:00; 02:30 happens twice.
    val t = Timing.Daily(2 * 60 + 30, emptySet())
    val first = NextRun.after(t, at("2026-10-25T00:00"), berlin)!!
    assertEquals("+02:00", local(first).offset.id)
    // The second 02:30 (an hour on) is not a run: the next is the day after.
    val next = NextRun.after(t, first, berlin)!!
    assertEquals(at("2026-10-26T02:30"), next)
    assertEquals(25L * 3_600_000, next - first)
  }

  @Test fun dailyFollowsTheZoneItIsWorkedOutIn() {
    val tokyo = ZoneId.of("Asia/Tokyo")
    val t = Timing.Daily(9 * 60, emptySet())
    val now = at("2026-11-13T08:00")
    val inTokyo = NextRun.after(t, now, tokyo)!!
    assertEquals(9, local(inTokyo, tokyo).hour)
    assertEquals(at("2026-11-13T09:00"), NextRun.after(t, now, berlin))
  }
}
