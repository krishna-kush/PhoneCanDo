package com.phonecando.runner.engine.work

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// An agent's own asks to stay up: their end, a new ask in place of the
// last, taking one back, and the reason as the notification shows it.
class KeepAsksTest {
  private var now = 1_000_000L
  private val asks = KeepAsks { now }

  @Test fun anAskLastsItsMinutes() {
    assertEquals(KeepAsks.Ask("waiting for Tester", 1_000_000L + 30 * 60_000L), asks.ask("a1", "waiting for Tester", 30))
    now += 30 * 60_000L - 1
    assertEquals("waiting for Tester", asks.get("a1")?.reason)
    now += 1
    assertNull(asks.get("a1"))
    assertNull(asks.get("a2"))
  }

  @Test fun aNewAskReplacesTheLastAndClearEndsIt() {
    asks.ask("a1", "first", 5)
    asks.ask("a1", "second", 60)
    now += 10 * 60_000L
    assertEquals("second", asks.get("a1")?.reason)
    asks.clear("a1")
    assertNull(asks.get("a1"))
  }

  @Test fun theReasonIsOneShortLine() {
    assertEquals("a CI run on main", KeepAsks.tidy("  a CI run\non   main \t"))
    val long = KeepAsks.tidy("x".repeat(500))
    assertEquals(WorkRules.ASK_REASON_MAX, long.length)
    assertEquals('…', long.last())
  }
}
