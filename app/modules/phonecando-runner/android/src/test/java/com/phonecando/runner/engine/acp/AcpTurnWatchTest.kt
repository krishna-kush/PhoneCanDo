package com.phonecando.runner.engine.acp

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// JVM checks for when an ACP turn counts as silent: three minutes with no
// sign, where anything the agent sends, an open question, a running tool
// call or its local model at work moves the clock on.
class AcpTurnWatchTest {
  private val minute = 60_000L
  private val look = AcpTurnWatch.LOOK_MS

  // Looks every LOOK_MS from [from] to [to]; true once one found it silent.
  private fun looks(watch: AcpTurnWatch, from: Long, to: Long, holding: (Long) -> Boolean = { false }): Long? {
    var t = from
    while (t <= to) {
      if (watch.silent(t, holding(t))) return t
      t += look
    }
    return null
  }

  @Test fun theLimitIsThreeMinutes() {
    assertEquals(3 * minute, AcpTurnWatch.SILENT_MS)
    assertTrue(AcpTurnWatch.REASON.contains("3 minutes"))
    assertTrue(AcpTurnWatch.HOLD_WHY.contains("3 minutes"))
  }

  @Test fun aTurnThatShowsNothingIsSilentAfterThreeMinutes() {
    val watch = AcpTurnWatch(startedAt = 0)
    assertFalse(watch.silent(3 * minute - 1, holding = false))
    assertTrue(watch.silent(3 * minute, holding = false))
  }

  @Test fun anythingTheAgentSendsMovesTheClockOn() {
    val watch = AcpTurnWatch(startedAt = 0)
    watch.sign(2 * minute)
    assertFalse(watch.silent(4 * minute, holding = false))
    assertTrue(watch.silent(5 * minute, holding = false))
    // An older sign never moves it back.
    watch.sign(minute)
    assertTrue(watch.silent(5 * minute, holding = false))
  }

  @Test fun aQuestionOrARunningToolCallHoldsItAndThenTheClockStartsAgain() {
    val watch = AcpTurnWatch(startedAt = 0)
    // A question open for ten minutes (or a long build): never silent.
    assertEquals(null, looks(watch, look, 10 * minute) { true })
    // Answered at 10 min: three more minutes of nothing.
    assertFalse(watch.silent(12 * minute, holding = false))
    assertTrue(watch.silent(13 * minute, holding = false))
  }

  @Test fun aLocalModelReadingItsPromptForMinutesIsNoSilentTurn() {
    // The 0.8B model on our test phone reads a prompt for 3-5 minutes,
    // and the agent sends nothing until then: the model at work is the sign.
    val watch = AcpTurnWatch(startedAt = 0)
    val reading = 5 * minute
    assertEquals(null, looks(watch, look, reading) { it <= reading })
    // It writes: the agent's text comes.
    watch.sign(reading + 20_000)
    assertEquals(null, looks(watch, reading + look, reading + 3 * minute))
    // Then nothing at all: silent three minutes after the last sign.
    assertEquals(reading + 20_000 + 3 * minute, looks(watch, reading + look, reading + 10 * minute))
  }

  @Test fun theSameTurnWithNoModelAtWorkIsSilent() {
    val watch = AcpTurnWatch(startedAt = 0)
    assertEquals(3 * minute, looks(watch, look, 5 * minute))
  }

  @Test fun aToolCallRunsUntilItCompletesOrFails() {
    fun tool(status: String?) = AcpItem.Tool("tool:1", "Run tests", "execute", status)
    assertTrue(AcpTurnWatch.toolRunning(listOf(tool("pending"))))
    assertTrue(AcpTurnWatch.toolRunning(listOf(tool("in_progress"))))
    assertTrue(AcpTurnWatch.toolRunning(listOf(tool(null))))
    assertFalse(AcpTurnWatch.toolRunning(listOf(tool("completed"), AcpItem.Text("m1", "done"))))
    assertFalse(AcpTurnWatch.toolRunning(listOf(tool("failed"))))
    assertFalse(AcpTurnWatch.toolRunning(emptyList()))
  }
}
