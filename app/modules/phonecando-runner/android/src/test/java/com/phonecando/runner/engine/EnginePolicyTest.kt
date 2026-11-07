package com.phonecando.runner.engine

import com.phonecando.runner.engine.EnginePolicy.Admission
import com.phonecando.runner.engine.EnginePolicy.Seat
import org.junit.Assert.assertEquals
import org.junit.Test

// JVM checks for the three-engine cap and who gives way.
class EnginePolicyTest {
  private val now = 1_000_000L
  private val minute = EnginePolicy.IDLE_MS

  @Test fun admitsUnderTheCap() {
    assertEquals(Admission.Admit, EnginePolicy.admit(emptyList(), now))
    assertEquals(Admission.Admit, EnginePolicy.admit(listOf(Seat("a", now, true), Seat("b", now, true)), now))
  }

  @Test fun fullStopsTheLeastRecentlyUsedIdleEngine() {
    val seats = listOf(
      Seat("a", now - 2 * minute, true),
      Seat("b", now - 5 * minute, true),
      Seat("c", now - 10, true),
    )
    assertEquals(Admission.Evict("b"), EnginePolicy.admit(seats, now))
  }

  @Test fun fullWithNothingIdleRejects() {
    val seats = listOf(Seat("a", now - 10, true), Seat("b", now - minute + 1, true), Seat("c", now, true))
    assertEquals(Admission.Reject, EnginePolicy.admit(seats, now))
  }

  @Test fun idleMeansAMinuteOrMore() {
    val seats = listOf(Seat("a", now - minute, true), Seat("b", now, true), Seat("c", now, true))
    assertEquals(Admission.Evict("a"), EnginePolicy.admit(seats, now))
  }

  @Test fun aStartingEngineIsNeverStopped() {
    val seats = listOf(Seat("a", now - 10 * minute, false), Seat("b", now, true), Seat("c", now, true))
    assertEquals(Admission.Reject, EnginePolicy.admit(seats, now))
  }
}
