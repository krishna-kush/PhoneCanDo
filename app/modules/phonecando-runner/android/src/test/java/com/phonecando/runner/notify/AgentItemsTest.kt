package com.phonecando.runner.notify

import com.phonecando.runner.engine.work.WorkWatch
import org.junit.Assert.assertEquals
import org.junit.Test

class AgentItemsTest {
  private val names = mapOf("a1" to "Claude Code", "a2" to "opencode")

  private fun chat(agentId: String, title: String?, state: ChatBoard.State) = ChatBoard.Chat(agentId, "s-$title", state, title, 0L)

  @Test fun eachAgentHasItsOwnNotificationLandingOnItsHome() {
    val items = AgentItems.of(
      listOf(chat("a1", "Fix the login", ChatBoard.State.WORKING), chat("a2", null, ChatBoard.State.WAITING), chat("a1", "Tests", ChatBoard.State.DONE)),
      names,
    )
    assertEquals(listOf("agent:a1", "agent:a2"), items.map { it.key })
    assertEquals(listOf("Fix the login · Working", "Tests · Done"), items[0].lines)
    assertEquals(listOf("New chat · Waiting for your answer"), items[1].lines)
    assertEquals(LaunchTarget("home", "a2"), items[1].target)
    // The lock screen: no titles.
    assertEquals("1 working · 1 done", items[0].publicText)
  }

  @Test fun anAgentKeptUpGetsItsStopsJobsFirst() {
    val server = WorkWatch.Job("python3 -m http.server", 11, 1L)
    val vite = WorkWatch.Job("vite", 12, 2L)
    val work = listOf(WorkLines.Line("a1", "Claude Code", "running python3 -m http.server, vite", listOf(server, vite)))
    val item = AgentItems.of(emptyList(), names, work).single()
    assertEquals(listOf("running python3 -m http.server, vite"), item.lines)
    assertEquals(
      listOf(
        ServiceItem.Stop("Stop python3 -m http.server", "a1", server),
        ServiceItem.Stop("Stop vite", "a1", vite),
        ServiceItem.Stop("Stop Claude Code", "a1"),
      ),
      item.stops,
    )
    assertEquals("at work", item.publicText)
  }

  @Test fun noMoreThanThreeStops() {
    val jobs = (1..4).map { WorkWatch.Job("j$it", it, 0L) }
    val item = AgentItems.of(emptyList(), names, listOf(WorkLines.Line("a1", "Claude Code", "running j1, j2 +2 more", jobs))).single()
    assertEquals(listOf("Stop j1", "Stop j2", "Stop j3"), item.stops.map { it.label })
  }

  @Test fun stoppingSaysOnlyThatUnderARunningBar() {
    val item = AgentItems.of(listOf(chat("a1", "Fix", ChatBoard.State.WORKING)), names, stopping = listOf("a1")).single()
    assertEquals(listOf("Stopping…"), item.lines)
    assertEquals(ServiceItem.Bar(null), item.bar)
    assertEquals(emptyList<ServiceItem.Stop>(), item.stops)
  }

  @Test fun aJobBeingStoppedAndAStartAreOnTheirAgents() {
    val items = AgentItems.of(
      emptyList(), names, starting = listOf("a2"), ending = listOf(AgentItems.EndingJob("a1", "npm run dev")),
    )
    assertEquals(listOf("agent:a2", "agent:a1"), items.map { it.key })
    assertEquals(listOf("Starting"), items[0].lines)
    assertEquals("starting", items[0].publicText)
    assertEquals(listOf("Stopping npm run dev…"), items[1].lines)
    assertEquals(ServiceItem.Bar(null), items[1].bar)
  }
}
