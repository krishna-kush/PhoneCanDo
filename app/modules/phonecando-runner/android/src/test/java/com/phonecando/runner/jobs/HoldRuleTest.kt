package com.phonecando.runner.jobs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// When the jobs anchor asks for the foreground service, short of a phone:
// once per stretch of jobs, never while it is up, again after it is gone,
// and a refused ask only on the next new job.
class HoldRuleTest {
  private val one = setOf("model:1")
  private val two = setOf("model:1", "linux:job-1")

  @Test fun aJobWithTheServiceDownAsksOnce() {
    val first = HoldRule.onJobs(HoldRule.State(), one, serviceUp = false)
    assertTrue(first.ask)
    // Progress ticks while the start is on its way ask nothing more.
    val tick = HoldRule.onJobs(first.state, one, serviceUp = false)
    assertFalse(tick.ask)
  }

  @Test fun aRunningServiceIsNeverAskedFor() {
    val step = HoldRule.onJobs(HoldRule.State(), two, serviceUp = true)
    assertFalse(step.ask)
  }

  @Test fun theServiceGoneWhileJobsRunIsAskedForAgain() {
    var state = HoldRule.onJobs(HoldRule.State(), one, serviceUp = false).state
    state = HoldRule.serviceChanged(state)
    // Up: it holds by itself.
    state = HoldRule.onJobs(state, one, serviceUp = true).state
    // Gone (a time limit, the system): the next tick asks again.
    state = HoldRule.serviceChanged(state)
    assertTrue(HoldRule.onJobs(state, one, serviceUp = false).ask)
  }

  @Test fun aRefusedAskWaitsForTheNextJob() {
    var state = HoldRule.onJobs(HoldRule.State(), one, serviceUp = false).state
    state = HoldRule.refused(state)
    val tick = HoldRule.onJobs(state, one, serviceUp = false)
    assertFalse(tick.ask)
    val next = HoldRule.onJobs(tick.state, two, serviceUp = false)
    assertTrue(next.ask)
  }

  @Test fun noJobsForgetsEverything() {
    var state = HoldRule.onJobs(HoldRule.State(), one, serviceUp = false).state
    state = HoldRule.refused(state)
    val idle = HoldRule.onJobs(state, emptySet(), serviceUp = false)
    assertFalse(idle.ask)
    assertEquals(HoldRule.State(), idle.state)
    // The same job id after a pause counts as new again.
    assertTrue(HoldRule.onJobs(idle.state, one, serviceUp = false).ask)
  }
}
