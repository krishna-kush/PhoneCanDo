package com.phonecando.runner.notify

import com.phonecando.runner.engine.work.KeepAsks
import com.phonecando.runner.engine.work.WorkWatch
import org.junit.Assert.assertEquals
import org.junit.Test

class WorkLinesTest {
  private val names = mapOf("a1" to "Claude Code", "a2" to "opencode", "a3" to "Codex")
  private val time = { ms: Long -> "t$ms" }

  @Test fun agentsKeptUpBetweenChats() {
    val states = listOf(
      WorkWatch.State("a1", listOf("npm run dev", "sleep 600", "vite"), active = false, kept = false),
      WorkWatch.State("a2", emptyList(), active = false, kept = true),
      WorkWatch.State("a3", emptyList(), active = false, kept = false),
    )
    val lines = WorkLines.of(states, working = emptySet(), names = names, time = time)
    assertEquals(
      listOf("Claude Code · running npm run dev, sleep 600 +1 more", "opencode · kept running"),
      lines.map { it.text },
    )
    assertEquals("2 agents kept running", WorkLines.count(lines))
  }

  @Test fun aWorkingAgentHasItsChatLineInstead() {
    val states = listOf(WorkWatch.State("a1", listOf("npm test"), active = true, kept = false))
    assertEquals(emptyList<WorkLines.Line>(), WorkLines.of(states, working = setOf("a1"), names = names, time = time))
    assertEquals("", WorkLines.count(emptyList()))
  }

  @Test fun anAgentThatAskedToStayUpShowsWhyAndUntilWhen() {
    val ask = KeepAsks.Ask("waiting for Tester's answer", 42L)
    val states = listOf(
      WorkWatch.State("a1", emptyList(), active = false, kept = false, ask = ask),
      // Jobs or the user's switch say more than the ask.
      WorkWatch.State("a2", listOf("vite"), active = false, kept = false, ask = ask),
      WorkWatch.State("a3", emptyList(), active = false, kept = true, ask = ask),
    )
    assertEquals(
      listOf("Claude Code · kept running: waiting for Tester's answer (until t42)", "opencode · running vite", "Codex · kept running"),
      WorkLines.of(states, working = emptySet(), names = names, time = time).map { it.text },
    )
  }
}
