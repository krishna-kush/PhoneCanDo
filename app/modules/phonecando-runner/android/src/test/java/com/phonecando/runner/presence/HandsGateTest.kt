package com.phonecando.runner.presence

import com.phonecando.runner.bridge.Route
import com.phonecando.runner.presence.HandsGate.Refusal
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// The gate per route, mode and agent.
class HandsGateTest {
  private val watch = HandOver("a1", "opencode", HandMode.WATCH, HandBy.USER, null, 0)
  private val paused = watch.copy(mode = HandMode.PAUSED)
  private val screen = Route.entries.filter { it.screen }
  private val other = Route.entries.filterNot { it.screen }

  @Test fun noHandOverPassesEverything() {
    for (r in Route.entries) assertNull(HandsGate.check("a1", r, null))
  }

  @Test fun routesThatLeaveTheScreenAlwaysPass() {
    for (r in other) {
      assertNull(HandsGate.check("a1", r, paused))
      assertNull(HandsGate.check("a2", r, watch))
    }
    assertNull(HandsGate.check("a1", Route.HANDS_WAIT, watch))
  }

  @Test fun theWatchingAgentMayOnlyObserve() {
    assertNull(HandsGate.check("a1", Route.PCE_OBSERVE, watch))
    for (r in screen - Route.PCE_OBSERVE) assertEquals(r.path, Refusal.USER_HAS_CONTROLS, HandsGate.check("a1", r, watch))
  }

  @Test fun thePausedAgentMayDoNothing() {
    for (r in screen) assertEquals(r.path, Refusal.PAUSED_BY_USER, HandsGate.check("a1", r, paused))
  }

  @Test fun anAgentLeftStoppedStaysOffTheScreenWithNoHandOver() {
    for (r in screen) assertEquals(r.path, Refusal.PAUSED_BY_USER, HandsGate.check("a1", r, null, left = true))
    for (r in other) assertNull(HandsGate.check("a1", r, null, left = true))
  }

  @Test fun anyOtherAgentIsTurnedAway() {
    for (h in listOf(watch, paused)) {
      for (r in screen) assertEquals(r.path, Refusal.USER_HAS_CONTROLS, HandsGate.check("a2", r, h))
    }
  }
}
