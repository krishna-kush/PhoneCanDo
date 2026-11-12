package com.phonecando.runner.engine.work

import com.phonecando.runner.engine.proc.ProcDetail
import com.phonecando.runner.engine.proc.Stdin
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// The watch's looks driven by hand (tick), over a fake host and process
// list: what it reports, when it stops an agent, and busyNow.
class WorkWatchTest {
  private var now = 1_000_000L
  private var foreground = true
  private var procs = listOf<ProcDetail>()
  private val stopped = ArrayList<String>()
  private val looks = ArrayList<Boolean>()
  private var agents = listOf(agent("a1"))

  private fun agent(id: String, idle: Boolean = true, kept: Boolean = false, ask: KeepAsks.Ask? = null) =
    WorkWatch.Agent(id, ready = true, idle = idle, quietMs = 60_000L, firstInputAt = 500_000L, kept = kept, ask = ask)

  private val host = object : WorkWatch.Host {
    override fun agents() = agents

    override fun foreground() = foreground

    override fun screenInUse() = false

    override fun stop(agentId: String) {
      stopped += agentId
    }
  }

  private val watch = WorkWatch(host, { procs }, { _, _ -> emptyMap() }, { looks += it }, clock = { now })

  private fun p(pid: Int, ppid: Int, startedAt: Long, vararg argv: String) =
    ProcDetail(pid, ppid, startedAt, "a1", 0, argv.first(), argv.toList(), Stdin(Stdin.Kind.NULL), 0L)

  private val engine = p(10, 1, 100_000L, "claude")

  @Test fun reportsJobsAndKeepsAnAgentWithOneUp() {
    procs = listOf(engine, p(20, 10, 900_000L, "npm", "run", "dev"))
    foreground = false
    assertEquals(WorkRules.POLL_MS, watch.tick())
    assertEquals(listOf("npm run dev"), watch.states().getValue("a1").jobs)
    assertEquals(listOf(true), looks)
    now += 120_000
    watch.tick()
    assertEquals(emptyList<String>(), stopped)
    // Nothing changed: told, but as unchanged.
    assertEquals(listOf(true, false), looks)
  }

  @Test fun stopsAnIdleAgentOnceAwayAndItsLastJobEndedAQuietTimeAgo() {
    procs = listOf(engine, p(20, 10, 900_000L, "sleep", "600"))
    foreground = false
    watch.tick()
    // The job ends; the agent stays a quiet time after.
    procs = listOf(engine)
    now += 30_000
    watch.tick()
    assertEquals(emptyList<String>(), stopped)
    now += 60_000
    watch.tick()
    assertEquals(listOf("a1"), stopped)
  }

  @Test fun neverStopsInFrontOrWhenKeptOrWorking() {
    procs = listOf(engine)
    watch.tick()
    now += 600_000
    watch.tick()
    assertEquals(emptyList<String>(), stopped)
    foreground = false
    agents = listOf(agent("a1", kept = true), agent("a2", idle = false))
    watch.tick()
    now += 600_000
    watch.tick()
    assertEquals(emptyList<String>(), stopped)
    assertTrue(watch.states().getValue("a1").kept)
  }

  @Test fun anAgentThatAskedToStayUpIsKeptUntilItsAskEnds() {
    val ask = KeepAsks.Ask("waiting for Tester", now + 3_600_000L)
    agents = listOf(agent("a1", ask = ask))
    procs = listOf(engine)
    foreground = false
    watch.tick()
    now += 600_000
    watch.tick()
    assertEquals(emptyList<String>(), stopped)
    assertEquals(ask, watch.states().getValue("a1").ask)
    assertTrue(watch.states().getValue("a1").held)
    assertTrue(watch.busyNow("a1"))
    // The ask ended (the host reads no live ask): idle and away, it stops.
    agents = listOf(agent("a1"))
    watch.tick()
    assertEquals(listOf("a1"), stopped)
  }

  @Test fun busyNowLooksAgain() {
    procs = listOf(engine)
    watch.tick()
    assertFalse(watch.busyNow("a1"))
    procs = listOf(engine, p(20, 10, 900_000L, "vite"))
    assertTrue(watch.busyNow("a1"))
    assertFalse(watch.busyNow("gone"))
  }

  @Test fun endsOnceNoEngineRuns() {
    procs = listOf(engine, p(20, 10, 900_000L, "vite"))
    watch.tick()
    agents = emptyList()
    assertNull(watch.tick())
    assertEquals(emptyMap<String, WorkWatch.State>(), watch.states())
    assertEquals(listOf(true, true), looks)
  }
}
