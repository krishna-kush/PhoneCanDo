package com.phonecando.runner.schedule

import org.junit.Assert.assertEquals
import org.junit.Test

// What a due notice says, for an agent a tap runs the task for and one that reads it next turn.
class DueTextTest {
  @Test fun theTitleNamesTheAgent() {
    assertEquals("Cline 8a: scheduled task due", DueText.title("Cline 8a"))
  }

  @Test fun aTapRunsItSaysSoThenWhy() {
    assertEquals(
      "Tap to run it now: Check the build\nIt didn't run because its terminal was open on screen.",
      DueText.text("Check the build", AskReasons.TERMINAL_OPEN, tapRuns = true),
    )
  }

  @Test fun anAgentThatReadsItGetsItNextTurn() {
    assertEquals(
      "Check the build\nIt didn't run because PhoneCanDo was open; the agent gets it on its next turn.",
      DueText.text("Check the build", AskReasons.APP_OPEN, tapRuns = false),
    )
  }

  @Test fun noReasonNoSecondLine() {
    assertEquals("Check the build", DueText.text("Check the build", null, tapRuns = false))
    assertEquals("Tap to run it now: Check the build", DueText.text("Check the build", "  ", tapRuns = true))
  }

  @Test fun theTaskIsOneLineCut() {
    val long = "line one\nline two " + "x".repeat(200)
    val first = DueText.text(long, null, tapRuns = false)
    assertEquals(DueText.TASK_MAX, first.length)
    assertEquals("line one line two ", first.take(18))
  }
}
