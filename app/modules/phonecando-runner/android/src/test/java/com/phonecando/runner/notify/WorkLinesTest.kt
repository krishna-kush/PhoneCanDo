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

  @Test fun eachJobComesWithItsRootForAStopOfItsOwn() {
    val server = WorkWatch.Job("python3 -m http.server", 22, 202)
    val vite = WorkWatch.Job("vite", 30, 300)
    val states = listOf(WorkWatch.State("a2", listOf(server.name, vite.name), active = false, kept = false, refs = listOf(server, vite)))
    val lines = WorkLines.of(states, working = emptySet(), names = names, time = time)
    assertEquals(listOf(WorkLines.Line("a2", "opencode", "opencode · running python3 -m http.server, vite", listOf(server, vite))), lines)
  }

  @Test fun aJobBeingStoppedIsOffItsLineAtOnce() {
    val server = WorkWatch.Job("python3 -m http.server", 22, 202)
    val vite = WorkWatch.Job("vite", 30, 300)
    val both = WorkWatch.State("a2", listOf(server.name, vite.name), active = false, kept = false, refs = listOf(server, vite))
    val one = WorkLines.of(listOf(both), working = emptySet(), names = names, time = time, ending = setOf(22))
    assertEquals(listOf("opencode · running vite"), one.map { it.text })
    assertEquals(listOf(vite), one.single().jobs)
    // Its only job stopping, and nothing else to keep it listed: no line.
    val alone = WorkWatch.State("a2", listOf(server.name), active = false, kept = false, refs = listOf(server))
    assertEquals(emptyList<WorkLines.Line>(), WorkLines.of(listOf(alone), emptySet(), names, setOf(22), time))
    // Kept running: it stays, with nothing left to stop alone.
    val kept = alone.copy(kept = true)
    assertEquals(listOf("opencode · kept running"), WorkLines.of(listOf(kept), emptySet(), names, setOf(22), time).map { it.text })
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

  @Test fun aJobStartingAndAnAgentAtWorkUnseen() {
    val states = listOf(
      // The run ended seconds ago with `npm run dev &`: named before it is decided.
      WorkWatch.State("a1", emptyList(), active = false, kept = false, starting = listOf("npm run dev")),
      WorkWatch.State("a2", listOf("vite"), active = false, kept = false, starting = listOf("vite", "tsc")),
      // Its kind tells no chats, and it printed lately.
      WorkWatch.State("a3", emptyList(), active = false, kept = false, printing = true),
    )
    assertEquals(
      listOf("Claude Code · running npm run dev", "opencode · running vite, tsc", "Codex · active"),
      WorkLines.of(states, working = emptySet(), names = names, time = time).map { it.text },
    )
  }
}
