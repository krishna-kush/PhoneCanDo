package com.phonecando.runner.engine

import com.phonecando.runner.bridge.CallerAuth
import com.phonecando.runner.bridge.FakeDirectory
import com.phonecando.runner.bridge.ScreenLease
import com.phonecando.runner.bridge.agent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// JVM checks for the bridge's view of the agents: only those whose engine runs.
class LiveAgentsTest {
  private val a = agent("a", "opencode")
  private val b = agent("b", "opencode 2")
  private val running = mutableSetOf("a", "b")
  private val live = LiveAgents(FakeDirectory(a, b)) { it in running }

  @Test fun onlyRunningAgentsAreSeen() {
    running.remove("b")
    assertEquals(listOf(a), live.all())
    assertEquals(a, live.get("a"))
    assertNull(live.get("b"))
    assertEquals(a, live.byBridgeToken(a.bridgeToken))
    assertNull(live.byBridgeToken(b.bridgeToken))
  }

  @Test fun aStoppedAgentsTokenNoLongerAuthenticates() {
    assertEquals(b, CallerAuth.caller("Bearer ${b.bridgeToken}", live))
    running.remove("b")
    assertNull(CallerAuth.caller("Bearer ${b.bridgeToken}", live))
  }

  @Test fun stoppingTheHolderFreesTheScreenAtOnce() {
    val lease = ScreenLease(idleMs = 30_000) { 0L }
    val alive: (String) -> Boolean = { live.get(it) != null }
    val ticket = (lease.claim("b", "opencode 2", alive) as ScreenLease.Granted).ticket
    lease.done(ticket)
    assertEquals(ScreenLease.Busy("opencode 2", 30_000), lease.claim("a", "opencode", alive))
    running.remove("b")
    assertTrue(lease.claim("a", "opencode", alive) is ScreenLease.Granted)
  }
}
