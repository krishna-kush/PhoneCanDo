package com.phonecando.runner.engine.starts

import com.phonecando.runner.engine.EngineState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// A failed start holds the agent back for ten minutes, with why, until any
// start of it comes up.
class StartHoldsTest {
  private var now = 1_000_000L
  private val holds = StartHolds { now }

  @Test fun aFailedStartHoldsTheAgentForTenMinutes() {
    assertEquals(10 * 60_000L, StartHolds.HOLD_MS)
    assertNull(holds.why("b"))
    holds.failed("b", "not ready after 120 s")
    now += StartHolds.HOLD_MS - 1
    assertEquals("not ready after 120 s", holds.why("b"))
    assertNull(holds.why("c"))
    now += 1
    assertNull(holds.why("b"))
  }

  @Test fun aLaterFailureCountsFromThenAndForgetEndsIt() {
    holds.failed("b", "first")
    now += StartHolds.HOLD_MS - 1
    holds.failed("b", "second")
    now += StartHolds.HOLD_MS - 1
    assertEquals("second", holds.why("b"))
    holds.forget("b")
    assertNull(holds.why("b"))
  }

  @Test fun anEngineThatComesUpEndsTheHold() {
    holds.failed("b", "not ready after 120 s")
    for (state in listOf(EngineState.STARTING, EngineState.FAILED, EngineState.DIED, EngineState.STOPPING, EngineState.STOPPED)) {
      holds.statusChanged("b", state)
      assertEquals("not ready after 120 s", holds.why("b"))
    }
    holds.statusChanged("c", EngineState.READY)
    assertEquals("not ready after 120 s", holds.why("b"))
    holds.statusChanged("b", EngineState.READY)
    assertNull(holds.why("b"))
  }
}
