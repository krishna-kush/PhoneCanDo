package com.phonecando.runner.engine

import com.phonecando.runner.engine.EnginePolicy.Admission
import com.phonecando.runner.engine.EnginePolicy.Seat
import org.junit.Assert.assertEquals
import org.junit.Test

// JVM checks for the user's cap on running engines and who gives way.
class EnginePolicyTest {
  private val now = 1_000_000L
  private val minute = EnginePolicy.IDLE_MS

  @Test fun noCapAdmitsEveryStart() {
    val seats = (1..12).map { Seat("a$it", now - 10 * minute, true) }
    assertEquals(Admission.Admit, EnginePolicy.admit(seats, now, null))
    assertEquals(Admission.Admit, EnginePolicy.admit(emptyList(), now, null))
  }

  @Test fun admitsUnderTheCap() {
    assertEquals(Admission.Admit, EnginePolicy.admit(emptyList(), now, 3))
    assertEquals(Admission.Admit, EnginePolicy.admit(listOf(Seat("a", now, true), Seat("b", now, true)), now, 3))
  }

  @Test fun fullStopsTheLeastRecentlyUsedIdleEngine() {
    val seats = listOf(
      Seat("a", now - 2 * minute, true),
      Seat("b", now - 5 * minute, true),
      Seat("c", now - 10, true),
    )
    assertEquals(Admission.Evict("b"), EnginePolicy.admit(seats, now, 3))
  }

  @Test fun fullWithNothingIdleRejects() {
    val seats = listOf(Seat("a", now - 10, true), Seat("b", now - minute + 1, true), Seat("c", now, true))
    assertEquals(Admission.Reject, EnginePolicy.admit(seats, now, 3))
  }

  @Test fun idleMeansAMinuteOrMore() {
    val seats = listOf(Seat("a", now - minute, true), Seat("b", now, true), Seat("c", now, true))
    assertEquals(Admission.Evict("a"), EnginePolicy.admit(seats, now, 3))
  }

  @Test fun aStartingEngineIsNeverStopped() {
    val seats = listOf(Seat("a", now - 10 * minute, false), Seat("b", now, true), Seat("c", now, true))
    assertEquals(Admission.Reject, EnginePolicy.admit(seats, now, 3))
  }

  @Test fun aCapOfOneMakesRoomFromTheOneThatRuns() {
    assertEquals(Admission.Evict("a"), EnginePolicy.admit(listOf(Seat("a", now - minute, true)), now, 1))
    assertEquals(Admission.Reject, EnginePolicy.admit(listOf(Seat("a", now, true)), now, 1))
  }

  @Test fun aCapBelowWhatRunsDecidesOneAtATime() {
    // Four run and the cap is now two: the next start stops the least
    // recently used idle engine, then the supervisor asks again.
    val seats = listOf(
      Seat("a", now - 3 * minute, true),
      Seat("b", now - 4 * minute, true),
      Seat("c", now, true),
      Seat("d", now, true),
    )
    assertEquals(Admission.Evict("b"), EnginePolicy.admit(seats, now, 2))
  }
}
