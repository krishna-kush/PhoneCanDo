package com.phonecando.runner.schedule.reply

import com.phonecando.agents.kit.EngineEvent
import com.phonecando.runner.engine.acp.AcpItem
import com.phonecando.runner.schedule.ScheduleRules
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// A run's reply: an ACP turn's final answer, trimmed and capped; and how a
// run in a chat ended.
class RunReplyTest {
  private fun text(id: String, t: String) = AcpItem.Text(id, t)

  private fun tool(id: String) = AcpItem.Tool(id, "Run tests", "execute", "completed")

  @Test fun theAnswerIsTheTextAfterTheLastStep() {
    val items = listOf(text("1", "I'll run the tests."), tool("t1"), AcpItem.Thought("2", "All green."), text("3", " All 12 pass. "))
    assertEquals("All 12 pass.", RunReply.ofAcp(items))
    // Several messages after the last step are joined.
    assertEquals("Done.\n\nNothing else to do.", RunReply.ofAcp(listOf(tool("t1"), text("1", "Done."), text("2", "Nothing else to do."))))
    // A plan is a step too.
    assertEquals("b", RunReply.ofAcp(listOf(text("1", "a"), AcpItem.Plan("p", listOf("x")), text("2", "b"))))
    // Only text: all of it.
    assertEquals("Hello.", RunReply.ofAcp(listOf(text("1", "Hello."))))
  }

  @Test fun nothingAfterTheLastStepIsItsLastText() {
    assertEquals("Running them now.", RunReply.ofAcp(listOf(text("1", "Looking."), text("2", "Running them now."), tool("t1"))))
    assertEquals("Ran it.", RunReply.ofAcp(listOf(text("1", "Ran it."), tool("t1"), text("2", "  "))))
  }

  @Test fun noTextIsNoReply() {
    assertNull(RunReply.ofAcp(emptyList()))
    assertNull(RunReply.ofAcp(listOf(tool("t1"), AcpItem.Thought("2", "hm"))))
    assertNull(RunReply.ofAcp(listOf(text("1", " \n "))))
  }

  @Test fun aLongReplyIsCutWithAnEllipsis() {
    val long = "x".repeat(ScheduleRules.REPLY_MAX + 50)
    val cut = RunReply.cap(long)!!
    assertEquals(ScheduleRules.REPLY_MAX, cut.length)
    assertTrue(cut.endsWith("…"))
    assertEquals("x".repeat(ScheduleRules.REPLY_MAX), RunReply.cap("  " + "x".repeat(ScheduleRules.REPLY_MAX) + "\n"))
    // Never half an emoji.
    val emoji = "x".repeat(ScheduleRules.REPLY_MAX - 2) + "😀" + "tail"
    val safe = RunReply.cap(emoji)!!
    assertTrue(safe.endsWith("x…"))
    assertNull(RunReply.cap("   "))
    assertNull(RunReply.cap(null))
  }

  @Test fun howARunEnded() {
    assertEquals(RunEnd.DONE, RunEnd.of(EngineEvent(EngineEvent.Kind.FINISHED, "s")))
    assertEquals(RunEnd.FAILED, RunEnd.of(EngineEvent(EngineEvent.Kind.FAILED, "s")))
    assertEquals(RunEnd.STOPPED, RunEnd.of(EngineEvent(EngineEvent.Kind.STOPPED, "s")))
    // The server no longer runs it: its verdict got lost, so it is done.
    assertEquals(RunEnd.DONE, RunEnd.of(EngineEvent(EngineEvent.Kind.STOPPED, "s", guessed = true)))
    assertEquals(RunEnd.STOPPED, RunEnd.of(EngineEvent(EngineEvent.Kind.GONE, "s")))
    assertNull(RunEnd.of(EngineEvent(EngineEvent.Kind.WORKING, "s")))
    assertNull(RunEnd.of(EngineEvent(EngineEvent.Kind.WAITING, "s")))
    assertEquals(RunEnd.DONE, RunEnd.ofAcp("end_turn", null))
    assertEquals(RunEnd.STOPPED, RunEnd.ofAcp("cancelled", null))
    assertEquals(RunEnd.FAILED, RunEnd.ofAcp("refusal", null))
    assertEquals(RunEnd.FAILED, RunEnd.ofAcp(null, "the agent exited"))
  }
}
