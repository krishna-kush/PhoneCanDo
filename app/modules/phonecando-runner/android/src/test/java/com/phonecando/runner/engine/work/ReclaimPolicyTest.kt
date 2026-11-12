package com.phonecando.runner.engine.work

import com.phonecando.runner.engine.work.ReclaimPolicy.Agent
import org.junit.Assert.assertEquals
import org.junit.Test

class ReclaimPolicyTest {
  private val quiet = 60_000L
  private val now = 1_000_000L

  private fun agent(
    id: String,
    ready: Boolean = true,
    idle: Boolean = true,
    busy: Boolean = false,
    kept: Boolean = false,
    lastBusyAt: Long? = null,
  ) = Agent(id, ready, idle, busy, kept, quiet, lastBusyAt)

  private fun stop(agents: List<Agent>, awaySince: Long? = now - quiet, screenInUse: Boolean = false) =
    ReclaimPolicy.toStop(agents, awaySince, screenInUse, now)

  @Test fun stopsOnlyIdleAgentsWithNothingLeft() {
    val agents = listOf(
      agent("idle"),
      agent("working", idle = false),
      agent("job", busy = true),
      agent("kept", kept = true),
      agent("starting", ready = false),
    )
    assertEquals(listOf("idle"), stop(agents))
  }

  @Test fun nothingWhileTheAppIsInFrontOrJustLeft() {
    assertEquals(emptyList<String>(), stop(listOf(agent("a")), awaySince = null))
    assertEquals(emptyList<String>(), stop(listOf(agent("a")), awaySince = now - quiet + 1))
  }

  @Test fun nothingWhileAnAgentDrivesTheScreen() {
    assertEquals(emptyList<String>(), stop(listOf(agent("a")), screenInUse = true))
  }

  @Test fun aJobThatJustEndedLeavesTheAgentAQuietTime() {
    assertEquals(emptyList<String>(), stop(listOf(agent("a", lastBusyAt = now - 30_000))))
    assertEquals(listOf("a"), stop(listOf(agent("a", lastBusyAt = now - quiet))))
  }
}
