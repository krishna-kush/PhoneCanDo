package com.phonecando.runner.notify

import com.phonecando.runner.engine.work.WorkWatch
import org.junit.Assert.assertEquals
import org.junit.Test

class WorkLinesTest {
  private val names = mapOf("a1" to "Claude Code", "a2" to "opencode", "a3" to "Codex")

  @Test fun agentsKeptUpBetweenChats() {
    val states = listOf(
      WorkWatch.State("a1", listOf("npm run dev", "sleep 600", "vite"), active = false, kept = false),
      WorkWatch.State("a2", emptyList(), active = false, kept = true),
      WorkWatch.State("a3", emptyList(), active = false, kept = false),
    )
    val lines = WorkLines.of(states, working = emptySet(), names = names)
    assertEquals(
      listOf("Claude Code · running npm run dev, sleep 600 +1 more", "opencode · kept running"),
      lines.map { it.text },
    )
    assertEquals("2 agents kept running", WorkLines.count(lines))
  }

  @Test fun aWorkingAgentHasItsChatLineInstead() {
    val states = listOf(WorkWatch.State("a1", listOf("npm test"), active = true, kept = false))
    assertEquals(emptyList<WorkLines.Line>(), WorkLines.of(states, working = setOf("a1"), names = names))
    assertEquals("", WorkLines.count(emptyList()))
  }
}
