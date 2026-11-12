package com.phonecando.runner.controllock

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// One unlock per agent, ended by the agent, its engine or its idle time.
class AskGrantsTest {
  private var now = 0L
  private val grants = AskGrants(idleMs = 300_000) { now }

  @Test fun anUnlockIsTheAskingAgentsAlone() {
    grants.grant("a1")
    assertTrue(grants.allows("a1"))
    assertFalse(grants.allows("a2"))
    assertEquals(1, grants.count())
  }

  @Test fun useKeepsItAndIdleEndsIt() {
    grants.grant("a1")
    now += 200_000
    assertTrue(grants.allows("a1", use = true))
    now += 200_000
    // A look without use does not restart the idle time.
    assertTrue(grants.allows("a1"))
    now += 100_000
    assertFalse(grants.allows("a1"))
    assertEquals(0, grants.count())
  }

  @Test fun endAndClear() {
    grants.grant("a1")
    grants.grant("a2")
    grants.end("a1")
    assertFalse(grants.allows("a1"))
    assertTrue(grants.allows("a2"))
    grants.clear()
    assertEquals(0, grants.count())
  }
}
