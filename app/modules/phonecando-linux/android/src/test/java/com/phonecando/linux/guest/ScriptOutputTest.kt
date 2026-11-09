package com.phonecando.linux.guest

import com.phonecando.linux.jobs.ScriptActivity
import com.phonecando.linux.jobs.ScriptRetry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// JVM checks for what a guest script's output becomes: phases, retries, the tail, the log line.
class ScriptOutputTest {
  @Test fun phaseLinesNameThePhaseAndStayOutOfTheTail() {
    val out = ScriptOutput()
    assertNull(out.detail(null).phase)
    out.line("@phase runtime:node")
    out.line("fetching node")
    out.line("@phase packages")
    out.line("Setting up ripgrep")
    val detail = out.detail(null)
    assertEquals("packages", detail.phase)
    assertEquals(listOf("fetching node", "Setting up ripgrep"), detail.tail)
    assertEquals(2L, out.phases)
  }

  @Test fun theTailKeepsTheLastLines() {
    val out = ScriptOutput(tailLines = 3)
    (1..5).forEach { out.line("line $it") }
    assertEquals(listOf("line 3", "line 4", "line 5"), out.detail(7).tail)
    assertEquals(7, out.detail(7).exitCode)
  }

  @Test fun everyLineIsRedactedForLogAndTail() {
    val out = ScriptOutput()
    assertEquals("NPM_TOKEN=<secret>", out.line("NPM_TOKEN=abc123"))
    assertEquals(listOf("NPM_TOKEN=<secret>"), out.detail(null).tail)
  }

  @Test fun aRetryLastsUntilTheNextPhaseAndStartsTheTailAfresh() {
    val out = ScriptOutput()
    out.line("@phase install")
    assertEquals("the log keeps the failed try", "curl: (56) Recv failure", out.line("curl: (56) Recv failure"))
    out.line("@retry install 2/3")
    val retrying = out.detail(null)
    assertEquals(ScriptRetry(2, 3), retrying.retry)
    assertEquals("install", retrying.phase)
    assertEquals(emptyList<String>(), retrying.tail)
    out.line("added 5 packages")
    assertEquals(listOf("added 5 packages"), out.detail(null).tail)
    assertEquals(1L, out.phases)
    out.line("@phase verify")
    assertNull(out.detail(null).retry)
  }

  @Test fun aBadRetryLineIsAnOrdinaryLine() {
    val out = ScriptOutput()
    out.line("@retry install 4/3")
    assertNull(out.detail(null).retry)
    assertEquals(listOf("@retry install 4/3"), out.detail(null).tail)
  }

  @Test fun theActivityRidesAlong() {
    val activity = ScriptActivity(12, 3_000_000, 250_000)
    assertEquals(activity, ScriptOutput().detail(null, activity).activity)
    assertNull(ScriptOutput().detail(null).activity)
  }
}
