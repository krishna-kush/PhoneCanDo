package com.phonecando.runner.schedule

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneOffset

// What is due at an alarm: on time, late, missed past a day, never
// replayed; off and finished ones are not due.
class DueRulesTest {
  private val utc = ZoneOffset.UTC
  private val h = ScheduleRules.HOUR_MS
  private val now = 1_000L * h

  private fun schedule(timing: Timing, nextAt: Long?, on: Boolean = true) = Schedule(
    id = "s1", agentId = "a1", text = "check CI", timing = timing, chat = ChatMode.SAME, on = on,
    by = SetBy.USER, createdAt = 0, nextAt = nextAt, lastRun = null,
  )

  @Test fun theNumbers() {
    assertEquals(4000, ScheduleRules.MAX_TEXT)
    assertEquals(20, ScheduleRules.MAX_PER_AGENT)
    assertEquals(10, ScheduleRules.MAX_BY_AGENT)
    assertEquals(15, ScheduleRules.EVERY_MIN_MINUTES)
    assertEquals(366L * 24 * h, ScheduleRules.ONCE_MAX_AHEAD_MS)
    assertEquals(527_040, ScheduleRules.MAX_MINUTES)
    assertEquals(2 * h, ScheduleRules.BUSY_WAIT_MS)
    assertEquals(24 * h, ScheduleRules.LATE_MAX_MS)
    assertEquals(2 * 60_000L, ScheduleRules.LATE_MARK_MS)
    assertEquals(200, ScheduleRules.RUNS_KEPT)
  }

  @Test fun onTimeAndNotYet() {
    val once = schedule(Timing.Once(now), now)
    val due = DueRules.due(listOf(once), now, utc).single()
    assertTrue(due.run)
    assertFalse(due.late)
    assertNull(due.nextAt)
    assertTrue(DueRules.due(listOf(once), now - 1, utc).isEmpty())
  }

  @Test fun offOrFinishedIsNeverDue() {
    assertTrue(DueRules.due(listOf(schedule(Timing.Once(now), now, on = false)), now, utc).isEmpty())
    assertTrue(DueRules.due(listOf(schedule(Timing.Once(now - h), null)), now, utc).isEmpty())
  }

  @Test fun lateRunsOnceAndMovesToTheNextTimeAfterNow() {
    val every = Timing.Every(60, 0)
    val due = DueRules.due(listOf(schedule(every, now - 5 * h)), now + 60_000 * 10, utc).single()
    assertTrue(due.run)
    assertTrue(due.late)
    assertEquals(now - 5 * h, due.dueAt)
    // Five missed grid times are not replayed: the next is the first after now.
    assertEquals(now + h, due.nextAt)
    // Under the late mark it is on time.
    assertFalse(DueRules.due(listOf(schedule(every, now)), now + 60_000, utc).single().late)
  }

  @Test fun pastADayItIsMissed() {
    val daily = Timing.Daily(9 * 60, emptySet())
    val due = DueRules.due(listOf(schedule(daily, now - 25 * h)), now, utc).single()
    assertFalse(due.run)
    assertTrue(due.late)
    assertTrue(due.nextAt!! > now)
    assertTrue(DueRules.due(listOf(schedule(daily, now - 24 * h)), now, utc).single().run)
  }
}
