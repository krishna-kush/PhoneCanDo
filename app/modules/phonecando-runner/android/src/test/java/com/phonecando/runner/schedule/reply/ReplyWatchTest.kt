package com.phonecando.runner.schedule.reply

import com.phonecando.runner.schedule.ScheduleRules
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// A server run waits for its task to go into a chat, then that chat is
// watched until a run there ends: once, for REPLY_WAIT_MS at most, and not
// past its engine or its agent.
class ReplyWatchTest {
  private var now = 1_000L
  private val watch = ReplyWatch { now }
  private val run = ReplyWatch.Run("s1", 7)

  @Test fun theChatItWentIntoIsWatchedUntilItsRunEnds() {
    watch.coming("a1", run)
    // Another schedule's task, or another agent's chat, is not its.
    assertNull(watch.delivered("a1", "s2", "ses_1"))
    assertNull(watch.delivered("a2", "s1", "ses_1"))
    assertEquals(run, watch.delivered("a1", "s1", "ses_1"))
    // Taken: the same task again is no run.
    assertNull(watch.delivered("a1", "s1", "ses_2"))
    assertNull(watch.ended("a1", "ses_2"))
    assertEquals(run, watch.ended("a1", "ses_1"))
    assertNull(watch.ended("a1", "ses_1"))
  }

  @Test fun aLaterFiringTakesTheAgentsPlace() {
    watch.coming("a1", run)
    val later = ReplyWatch.Run("s1", 8)
    watch.coming("a1", later)
    assertEquals(later, watch.delivered("a1", "s1", "ses_1"))
  }

  @Test fun itWaitsSixHoursAtMost() {
    watch.coming("a1", run)
    now += ScheduleRules.REPLY_WAIT_MS
    assertNull(watch.delivered("a1", "s1", "ses_1"))
    watch.coming("a1", run)
    assertEquals(run, watch.delivered("a1", "s1", "ses_1"))
    now += ScheduleRules.REPLY_WAIT_MS - 1
    assertEquals(run, watch.ended("a1", "ses_1"))
    watch.coming("a1", run)
    watch.delivered("a1", "s1", "ses_1")
    now += ScheduleRules.REPLY_WAIT_MS
    assertNull(watch.ended("a1", "ses_1"))
  }

  @Test fun anEngineStopEndsTheWatchButNotATaskOnItsWay() {
    watch.coming("a1", run)
    watch.engineGone("a1")
    // Its task waits in the mailbox for the next start.
    assertEquals(run, watch.delivered("a1", "s1", "ses_1"))
    watch.engineGone("a1")
    assertNull(watch.ended("a1", "ses_1"))
  }

  @Test fun aForgottenAgentHasNothingWatched() {
    watch.coming("a1", run)
    watch.forget("a1")
    assertNull(watch.delivered("a1", "s1", "ses_1"))
    watch.coming("a1", run)
    watch.delivered("a1", "s1", "ses_1")
    watch.forget("a1")
    assertNull(watch.ended("a1", "ses_1"))
  }
}
