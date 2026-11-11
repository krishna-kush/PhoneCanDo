package com.phonecando.runner.memory

import com.phonecando.runner.memory.MemoryLevel.CRITICAL
import com.phonecando.runner.memory.MemoryLevel.OK
import com.phonecando.runner.memory.MemoryLevel.WARN
import com.phonecando.runner.memory.MemoryPolicy.Candidate
import com.phonecando.runner.memory.MemoryPolicy.State
import com.phonecando.runner.memory.MemoryRules.MIB
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// The memory guard's decisions, short of a phone: the numbers, the levels
// and their hysteresis, the countdowns through an episode, and who is
// stopped first.
class MemoryPolicyTest {
  // Our 8 GB test phone reports about 7.2 GiB; a threshold of 216 MiB.
  private val total = 7_372 * MIB
  private val threshold = 216 * MIB
  private fun reading(availMib: Long, low: Boolean = false) = MemoryReading(total, availMib * MIB, threshold, low)
  private val lines = MemoryPolicy.lines(reading(4_000))
  private val t0 = 1_000_000L

  @Test fun theNumbers() {
    assertEquals(12, MemoryRules.WARN_PERCENT)
    assertEquals(512 * MIB, MemoryRules.WARN_MARGIN)
    assertEquals(128 * MIB, MemoryRules.CRITICAL_MARGIN)
    assertEquals(4, MemoryRules.OK_HYSTERESIS_PERCENT)
    assertEquals(60_000L, MemoryRules.WARN_COUNTDOWN_MS)
    assertEquals(15_000L, MemoryRules.CRITICAL_COUNTDOWN_MS)
    assertEquals(10_000L, MemoryRules.SETTLE_MS)
    assertEquals(30_000L, MemoryRules.NEXT_COUNTDOWN_MS)
    assertEquals(5_000L, MemoryRules.POLL_MS)
  }

  @Test fun theLinesOfAnEightGigabytePhone() {
    // 12% of the total is above threshold + 512 MiB here.
    assertEquals(total * 12 / 100, lines.warnBelow)
    assertEquals(threshold + 128 * MIB, lines.criticalBelow)
    assertEquals(total * 12 / 100 + total * 4 / 100, lines.okFrom)
  }

  @Test fun aHighThresholdRaisesTheWarnLine() {
    val l = MemoryPolicy.lines(MemoryReading(total, 0, 1_024 * MIB, false))
    assertEquals(1_536 * MIB, l.warnBelow)
    assertEquals(1_152 * MIB, l.criticalBelow)
  }

  @Test fun levelsFromOk() {
    assertEquals(OK, MemoryPolicy.level(reading(3_000), OK))
    assertEquals(OK, MemoryPolicy.level(MemoryReading(total, lines.warnBelow, threshold, false), OK))
    assertEquals(WARN, MemoryPolicy.level(MemoryReading(total, lines.warnBelow - 1, threshold, false), OK))
    assertEquals(CRITICAL, MemoryPolicy.level(MemoryReading(total, lines.criticalBelow - 1, threshold, false), OK))
    // Android's own flag is critical whatever the numbers.
    assertEquals(CRITICAL, MemoryPolicy.level(reading(3_000, low = true), OK))
  }

  @Test fun backToOkOnlyPastTheHysteresis() {
    val between = MemoryReading(total, lines.warnBelow + 1, threshold, false)
    assertEquals(WARN, MemoryPolicy.level(between, WARN))
    assertEquals(WARN, MemoryPolicy.level(between, CRITICAL))
    assertEquals(OK, MemoryPolicy.level(between, OK))
    assertEquals(WARN, MemoryPolicy.level(MemoryReading(total, lines.okFrom - 1, threshold, false), WARN))
    assertEquals(OK, MemoryPolicy.level(MemoryReading(total, lines.okFrom, threshold, false), WARN))
  }

  @Test fun criticalEasesToWarnAtOnce() {
    assertEquals(WARN, MemoryPolicy.level(MemoryReading(total, lines.criticalBelow, threshold, false), CRITICAL))
  }

  @Test fun okHasNoCountdown() {
    val step = MemoryPolicy.step(State(), OK, canStop = true, now = t0)
    assertEquals(State(), step.state)
    assertFalse(step.stop)
  }

  @Test fun warnCountsDownAMinuteThenStopsOne() {
    var s = MemoryPolicy.step(State(), WARN, true, t0)
    assertEquals(t0 + 60_000, s.state.stopAt)
    assertFalse(s.stop)
    s = MemoryPolicy.step(s.state, WARN, true, t0 + 59_999)
    assertFalse(s.stop)
    assertEquals(t0 + 60_000, s.state.stopAt)
    s = MemoryPolicy.step(s.state, WARN, true, t0 + 60_000)
    assertTrue(s.stop)
    assertNull(s.state.stopAt)
    assertEquals(1, s.state.stops)
    assertEquals(t0 + 70_000, s.state.settleUntil)
  }

  @Test fun afterAStopItSettlesThenCountsThirtySeconds() {
    var s = MemoryPolicy.step(State(), WARN, true, t0).state
    s = MemoryPolicy.step(s, WARN, true, t0 + 60_000).state
    // Settling: no countdown, whatever the level.
    var step = MemoryPolicy.step(s, CRITICAL, true, t0 + 65_000)
    assertFalse(step.stop)
    assertNull(step.state.stopAt)
    assertEquals(CRITICAL, step.state.level)
    step = MemoryPolicy.step(step.state, WARN, true, t0 + 70_000)
    assertNull(step.state.settleUntil)
    assertEquals(t0 + 100_000, step.state.stopAt)
    step = MemoryPolicy.step(step.state, WARN, true, t0 + 100_000)
    assertTrue(step.stop)
    assertEquals(2, step.state.stops)
  }

  @Test fun stillCriticalAfterSettlingCountsFifteenSeconds() {
    var s = MemoryPolicy.step(State(), CRITICAL, true, t0).state
    s = MemoryPolicy.step(s, CRITICAL, true, t0 + 15_000).also { assertTrue(it.stop) }.state
    val step = MemoryPolicy.step(s, CRITICAL, true, t0 + 25_000)
    assertEquals(t0 + 40_000, step.state.stopAt)
  }

  @Test fun criticalShortensTheCountdownAndWarnGivesItBack() {
    var s = MemoryPolicy.step(State(), WARN, true, t0).state
    s = MemoryPolicy.step(s, CRITICAL, true, t0 + 10_000).state
    assertEquals(t0 + 25_000, s.stopAt)
    // Easing to warn: the minute from entering warn again.
    s = MemoryPolicy.step(s, WARN, true, t0 + 20_000).state
    assertEquals(t0 + 60_000, s.stopAt)
    // Critical late in the minute: the warn deadline is still the sooner.
    s = MemoryPolicy.step(s, CRITICAL, true, t0 + 50_000).state
    assertEquals(t0 + 60_000, s.stopAt)
  }

  @Test fun straightToCriticalCountsFifteenSeconds() {
    val s = MemoryPolicy.step(State(), CRITICAL, true, t0)
    assertEquals(t0 + 15_000, s.state.stopAt)
    assertTrue(MemoryPolicy.step(s.state, CRITICAL, true, t0 + 15_000).stop)
  }

  @Test fun nothingToStopKeepsWarningWithoutACountdown() {
    var s = MemoryPolicy.step(State(), WARN, false, t0)
    assertEquals(WARN, s.state.level)
    assertNull(s.state.stopAt)
    assertFalse(s.stop)
    s = MemoryPolicy.step(s.state, CRITICAL, false, t0 + 90_000)
    assertNull(s.state.stopAt)
    // Something may be stopped now: a fresh countdown from here.
    s = MemoryPolicy.step(s.state, WARN, true, t0 + 100_000)
    assertEquals(t0 + 160_000, s.state.stopAt)
    // And gone again mid-countdown: it ends.
    s = MemoryPolicy.step(s.state, WARN, false, t0 + 110_000)
    assertNull(s.state.stopAt)
  }

  @Test fun backToOkEndsTheEpisode() {
    var s = MemoryPolicy.step(State(), WARN, true, t0).state
    s = MemoryPolicy.step(s, WARN, true, t0 + 60_000).state
    s = MemoryPolicy.step(s, OK, true, t0 + 80_000).state
    assertEquals(State(), s)
    // The next episode starts with the full minute again.
    assertEquals(t0 + 150_000, MemoryPolicy.step(s, WARN, true, t0 + 90_000).state.stopAt)
  }

  @Test fun idleDropsTheCountdownAndKeepsTheEpisode() {
    var s = MemoryPolicy.step(State(), WARN, true, t0).state
    s = MemoryPolicy.step(s, WARN, true, t0 + 60_000).state
    val idle = MemoryPolicy.idle(s)
    assertNull(idle.stopAt)
    assertNull(idle.settleUntil)
    assertEquals(WARN, idle.level)
    assertEquals(1, idle.stops)
  }

  @Test fun victimsWithoutARunFirstThenLeastRecentlyUsed() {
    val agents = listOf(
      Candidate("busy-old", working = true, lastUsedAt = 100),
      Candidate("quiet-new", working = false, lastUsedAt = 900),
      Candidate("quiet-old", working = false, lastUsedAt = 200),
      Candidate("busy-new", working = true, lastUsedAt = 800),
    )
    assertEquals("quiet-old", MemoryPolicy.victim(agents, null))
    assertEquals("quiet-new", MemoryPolicy.victim(agents.filter { it.agentId != "quiet-old" }, null))
    assertEquals("busy-old", MemoryPolicy.victim(agents.filter { !it.agentId.startsWith("quiet") }, null))
    // Never used counts as oldest.
    assertEquals("never", MemoryPolicy.victim(agents + Candidate("never", false, null), null))
  }

  @Test fun theAgentOnScreenIsNeverStopped() {
    val agents = listOf(Candidate("open", false, 1), Candidate("other", true, 999))
    assertEquals("other", MemoryPolicy.victim(agents, keep = "open"))
    assertNull(MemoryPolicy.victim(listOf(Candidate("open", false, 1)), keep = "open"))
    assertNull(MemoryPolicy.victim(emptyList(), null))
  }
}
