package com.phonecando.runner.notify

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ServicePlanTest {
  private val names = mapOf("a1" to "Claude Code", "a2" to "opencode")

  private val download = TransferLines.of("Qwen3.5 4B", false, 45, 100).item("model:m1", LaunchTarget(LaunchTarget.MODELS, null), "A model coming in")

  @Test fun nothingRunningShowsNothing() {
    assertEquals(ServicePlan.Plan(null, emptyList()), ServicePlan.of(emptyList(), emptyList(), emptyList(), emptyList(), names, onScreen = false))
  }

  @Test fun enginesThatOnlyRunAreOneReadyLineAwayFromTheApp() {
    val plan = ServicePlan.of(emptyList(), emptyList(), emptyList(), listOf("a1", "a2"), names, onScreen = false)
    assertEquals(ServicePlan.Summary("Claude Code, opencode ready", "2 agents ready", null, group = false), plan.summary)
    assertEquals(LaunchTarget("home", "a1"), ServicePlan.of(emptyList(), emptyList(), emptyList(), listOf("a1"), names, false).summary?.target)
    assertNull(ServicePlan.of(emptyList(), emptyList(), emptyList(), listOf("a1"), names, onScreen = true).summary)
  }

  @Test fun eachAgentAndJobIsItsOwnItemUnderACountingHead() {
    val chats = listOf(ChatBoard.Chat("a1", "s1", ChatBoard.State.WORKING, "Fix", 0L))
    val agents = AgentItems.of(chats, names, starting = listOf("a2"))
    val plan = ServicePlan.of(agents, listOf(download), chats, listOf("a1"), names, onScreen = true)
    assertEquals(listOf("agent:a1", "agent:a2", "model:m1"), plan.items.map { it.key })
    // Every chat listed is one agent's: the head lands on its Home.
    assertEquals(ServicePlan.Summary("1 working · 1 agent at work · 1 job running", "1 working · 1 agent at work · 1 job running", LaunchTarget("home", "a1"), group = true), plan.summary)
  }

  @Test fun theHeadsTapIsTheOnePlaceItsItemsAreAbout() {
    val plan = ServicePlan.of(emptyList(), listOf(download, download.copy(key = "model:m2")), emptyList(), emptyList(), names, false)
    assertEquals(LaunchTarget("models", null), plan.summary?.target)
    assertEquals("2 jobs running", plan.summary?.text)
  }
}
