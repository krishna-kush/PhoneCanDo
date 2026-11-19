package com.phonecando.runner.autooff

import com.phonecando.runner.autooff.AutoOffRules.Facts
import com.phonecando.runner.autooff.AutoOffRules.QUIET_MS
import com.phonecando.runner.autooff.AutoOffRules.Step
import com.phonecando.runner.autooff.AutoOffRules.WARM_UP_MS
import org.junit.Assert.assertEquals
import org.junit.Test

// When Auto off turns the service off: only with the switch on, the app
// out of sight and nobody wanting the screen, after the quiet and never
// in the warm-up.
class AutoOffRulesTest {
  // Connected long ago: the warm-up is over.
  private val quiet = Facts(on = true, appInFront = false, screenWanted = false, connectedAt = 0)
  private val late = WARM_UP_MS + 1_000

  @Test fun offOnceQuietLongEnough() {
    assertEquals(Step(late, false), AutoOffRules.step(quiet, null, late))
    assertEquals(Step(late, false), AutoOffRules.step(quiet, late, late + QUIET_MS - 1))
    assertEquals(Step(late, true), AutoOffRules.step(quiet, late, late + QUIET_MS))
  }

  @Test fun theSwitchOffNeverTurnsItOff() {
    assertEquals(Step(null, false), AutoOffRules.step(quiet.copy(on = false), late, late + QUIET_MS * 10))
  }

  @Test fun theAppInFrontOrAWantedScreenStartsTheQuietOver() {
    assertEquals(Step(null, false), AutoOffRules.step(quiet.copy(appInFront = true), late, late + QUIET_MS))
    assertEquals(Step(null, false), AutoOffRules.step(quiet.copy(screenWanted = true), late, late + QUIET_MS))
    // Quiet again: counted from now, not from before.
    val again = late + QUIET_MS * 2
    assertEquals(Step(again, false), AutoOffRules.step(quiet, null, again))
  }

  @Test fun neverInTheWarmUp() {
    val fresh = quiet.copy(connectedAt = 1_000)
    assertEquals(Step(1_000, false), AutoOffRules.step(fresh, 1_000, 1_000 + WARM_UP_MS - 1))
    assertEquals(Step(1_000, true), AutoOffRules.step(fresh, 1_000, 1_000 + WARM_UP_MS))
  }
}
