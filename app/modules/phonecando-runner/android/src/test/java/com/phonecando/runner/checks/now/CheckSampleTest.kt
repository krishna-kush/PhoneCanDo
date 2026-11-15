package com.phonecando.runner.checks.now

import com.phonecando.runner.checks.now.CheckRun.Step
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

// A look's step (first match wins) and the print that tells movement.
class CheckSampleTest {
  private val ready = CheckSample(engine = "ready/terminal", ready = true)

  private fun step(sample: CheckSample, launched: Boolean = true, turnEnded: Boolean = false, taskless: Boolean = false, readySeen: Boolean = true) =
    CheckSample.step(launched, turnEnded, taskless, readySeen, sample)

  @Test fun stepsInOrder() {
    assertEquals(Step.CHECKING, step(ready.copy(asking = true), turnEnded = true))
    assertEquals(Step.CHECKING, step(ready, taskless = true))
    assertEquals(Step.STARTING, step(ready.copy(ready = false), taskless = true, readySeen = false))
    assertEquals(Step.STARTING, step(ready, launched = false))
    assertEquals(Step.STARTING, step(ready.copy(ready = false)))
    assertEquals(Step.ANSWER, step(ready.copy(asking = true, reading = CheckRun.Reading(1, 2))))
    assertEquals(Step.READING, step(ready.copy(reading = CheckRun.Reading(1, 2))))
    assertEquals(Step.WORKING, step(ready))
  }

  @Test fun everyMoveButTheViewerChangesThePrint() {
    val base = ready.print(Step.WORKING)
    assertEquals(base, ready.copy(viewer = true).print(Step.WORKING))
    assertNotEquals(base, ready.print(Step.READING))
    assertNotEquals(base, ready.copy(engine = "starting/terminal").print(Step.WORKING))
    assertNotEquals(base, ready.copy(reading = CheckRun.Reading(1, null)).print(Step.WORKING))
    assertNotEquals(base, ready.copy(acpItems = 1).print(Step.WORKING))
    assertNotEquals(
      ready.copy(acpLast = mapOf("text" to "a")).print(Step.WORKING),
      ready.copy(acpLast = mapOf("text" to "ab")).print(Step.WORKING),
    )
    assertNotEquals(base, ready.copy(signAt = 5L).print(Step.WORKING))
    assertNotEquals(base, ready.copy(heard = 1).print(Step.WORKING))
  }
}
