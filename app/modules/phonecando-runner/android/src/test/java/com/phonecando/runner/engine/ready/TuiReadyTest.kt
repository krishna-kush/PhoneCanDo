package com.phonecando.runner.engine.ready

import com.phonecando.agents.kit.render.TuiReadiness
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// JVM checks for a TUI engine's readiness: after the first output and then
// quiet, or after a while alive.
class TuiReadyTest {
  private var now = 10_000L
  private var lastOutput: Long? = null

  @Test fun outputThenQuiet() {
    val ready = OutputReady({ lastOutput }, settleMs = 400, timeoutMs = 60_000, now = { now })
    assertEquals(ReadyProbe.Verdict.WAIT, ready.check())
    lastOutput = now
    now += 399
    assertEquals(ReadyProbe.Verdict.WAIT, ready.check())
    now += 1
    assertEquals(ReadyProbe.Verdict.READY, ready.check())
    assertEquals(60_000L, ready.timeoutMs)
  }

  @Test fun alive() {
    val ready = AliveReady(startedAt = now, ms = 500, now = { now })
    assertEquals(ReadyProbe.Verdict.WAIT, ready.check())
    now += 500
    assertEquals(ReadyProbe.Verdict.READY, ready.check())
  }

  @Test fun byTheKindsReadiness() {
    assertTrue(TuiReady.of(TuiReadiness.Output(1, 2), { null }, 0) is OutputReady)
    assertTrue(TuiReady.of(TuiReadiness.Alive(1), { null }, 0) is AliveReady)
  }
}
