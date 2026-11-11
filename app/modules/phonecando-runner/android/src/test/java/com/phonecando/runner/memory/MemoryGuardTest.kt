package com.phonecando.runner.memory

import com.phonecando.runner.memory.MemoryRules.MIB
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// The guard's looks one at a time (tick), over a fake supervisor and phone:
// what it tells, when it stops an agent, what it posts.
class MemoryGuardTest {
  private val total = 8_192 * MIB
  private var avail = 4_000 * MIB
  private var now = 1_000_000L

  private inner class Host : MemoryGuard.Host {
    val agents = mutableListOf<MemoryAgent>()
    val models = mutableListOf<MemoryModel>()
    var open: String? = null
    var foreground = false
    val stopped = mutableListOf<String>()

    override fun agents() = agents.toList()

    override fun models() = models.toList()

    override fun openAgent() = open

    override fun foreground() = foreground

    override fun anyRunning() = agents.isNotEmpty() || models.isNotEmpty()

    override fun stop(agentId: String) {
      stopped += agentId
      agents.removeAll { it.agentId == agentId }
      // Its model goes with its last holder.
      models.removeAll { m -> m.agentIds.all { it == agentId } }
      avail += 1_500 * MIB
    }

    override fun name(agentId: String) = "Agent $agentId"
  }

  private class Alerts : MemoryGuard.Alerts {
    val posted = mutableListOf<String>()

    override fun warn(stopInMs: Long?) {
      posted += "warn:$stopInMs"
    }

    override fun stopped(names: List<String>) {
      posted += "stopped:${names.joinToString()}"
    }

    override fun clear() {
      posted += "clear"
    }
  }

  private val host = Host()
  private val alerts = Alerts()
  private val told = mutableListOf<MemoryStatus>()
  private var bytesReads = 0
  private val guard = MemoryGuard(
    host = host,
    system = { MemoryReading(total, avail, 256 * MIB, false) },
    owners = {
      bytesReads++
      ProcessMemory.Owners(mapOf("a1" to 300 * MIB, "a2" to 200 * MIB), mapOf("qwen" to 2_000 * MIB))
    },
    alerts = alerts,
    onChange = { told += it },
    clock = { now },
  )

  private fun twoAgents() {
    host.agents += MemoryAgent("a1", null, working = false, lastUsedAt = 100, modelId = "qwen")
    host.agents += MemoryAgent("a2", null, working = true, lastUsedAt = 50, modelId = null)
    host.models += MemoryModel("qwen", "Qwen", null, listOf("a1"), ready = true)
  }

  @Test fun nothingRunningEndsTheThread() {
    assertNull(guard.tick())
    assertTrue(told.isEmpty())
  }

  @Test fun okIsToldOnceAndReadsNoProcesses() {
    twoAgents()
    assertEquals(MemoryRules.POLL_MS, guard.tick())
    assertEquals(MemoryRules.POLL_MS, guard.tick())
    assertEquals(1, told.size)
    assertEquals(MemoryLevel.OK, told[0].level)
    assertNull(told[0].agents[0].bytes)
    assertEquals(0, bytesReads)
  }

  @Test fun shortMemoryCountsDownThenStopsTheQuietestAgent() {
    twoAgents()
    guard.tick()
    avail = 500 * MIB
    assertEquals(MemoryRules.POLL_MS, guard.tick())
    val warn = told.last()
    assertEquals(MemoryLevel.WARN, warn.level)
    assertEquals(now + 60_000, warn.stopAt)
    // a2 is used less recently, but working: a1 goes first.
    assertEquals("a1", warn.nextStopAgentId)
    assertEquals(300 * MIB, warn.agents.first { it.agentId == "a1" }.bytes)
    assertEquals(2_000 * MIB, warn.models.single().bytes)
    assertEquals(listOf("warn:60000"), alerts.posted)
    // Told on every look while not ok; warned once.
    now += 5_000
    guard.tick()
    assertEquals(3, told.size)
    assertEquals(listOf("warn:60000"), alerts.posted)
    // The last look before the stop waits only until it is due.
    now += 52_000
    assertEquals(3_000L, guard.tick())
    now += 3_000
    assertEquals(0L, guard.tick())
    assertEquals(listOf("a1"), host.stopped)
    assertEquals(listOf("warn:60000", "stopped:Agent a1"), alerts.posted)
    // The next look tells what was stopped: the agent and its model.
    guard.tick()
    val after = told.last()
    assertEquals(AutoStop(now, listOf("a1"), listOf("qwen")), after.lastAutoStop)
    assertEquals(listOf("a2"), after.agents.map { it.agentId })
  }

  @Test fun theAgentOnScreenIsKeptAndNothingIsPostedInFront() {
    host.agents += MemoryAgent("a1", null, working = false, lastUsedAt = 100, modelId = null)
    host.open = "a1"
    host.foreground = true
    avail = 300 * MIB
    guard.tick()
    val status = told.last()
    assertEquals(MemoryLevel.CRITICAL, status.level)
    assertNull(status.stopAt)
    assertNull(status.nextStopAgentId)
    now += 120_000
    guard.tick()
    assertTrue(host.stopped.isEmpty())
    assertTrue(alerts.posted.isEmpty())
    // In the background it may go: a fresh countdown, and the warning.
    host.foreground = false
    guard.tick()
    assertEquals(now + 15_000, told.last().stopAt)
    assertEquals(listOf("warn:15000"), alerts.posted)
  }

  @Test fun aWarningNothingCameOfGoesWhenMemoryIsBack() {
    twoAgents()
    avail = 500 * MIB
    guard.tick()
    avail = 4_000 * MIB
    guard.tick()
    assertEquals(MemoryLevel.OK, told.last().level)
    assertEquals(listOf("warn:60000", "clear"), alerts.posted)
  }

  @Test fun statusReadsEveryProcessWhateverTheLevel() {
    twoAgents()
    val status = guard.status()
    assertEquals(MemoryLevel.OK, status.level)
    assertEquals(total, status.totalBytes)
    assertEquals(MemoryPolicy.lines(MemoryReading(total, avail, 256 * MIB, false)).warnBelow, status.warnBelowBytes)
    assertEquals(300 * MIB, status.agents.first { it.agentId == "a1" }.bytes)
    assertEquals(1, bytesReads)
    assertFalse(status.toMap().isEmpty())
  }

  @Test fun everythingStoppedEndsTheCountdown() {
    twoAgents()
    avail = 500 * MIB
    guard.tick()
    host.agents.clear()
    host.models.clear()
    assertNull(guard.tick())
    assertNull(told.last().stopAt)
    // Nothing of ours left to stop: the warning goes.
    assertEquals(listOf("warn:60000", "clear"), alerts.posted)
  }
}
