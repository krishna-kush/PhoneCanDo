package com.phonecando.linux.images

import com.phonecando.network.Progress
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// JVM checks for the setup step a failed create names, and the step starts JS sees.
class SetupStepTrackerTest {
  private val seen = ArrayList<Progress>()
  private val tracker = SetupStepTracker { seen += it }

  @Test fun itRemembersTheLastSetupStepOnly() {
    assertNull(tracker.step)
    tracker.report(Progress("space", 0, 6))
    tracker.report(Progress("unpack", 1, 6))
    tracker.report(Progress("unpack", 1_000_000, null))
    tracker.report(Progress("measure", 0, null))
    assertEquals("unpack", tracker.step)
  }

  @Test fun aStepAnnouncementBecomesTheStepsStart() {
    tracker.report(Progress("unpack", 1, 6))
    tracker.report(Progress("unpack", 4096, 8192))
    tracker.report(Progress("detect", 2, 6))
    assertEquals(
      listOf(Progress("unpack", 0, null), Progress("unpack", 4096, 8192), Progress("detect", 0, null)),
      seen,
    )
  }

  @Test fun otherStepsPassAsTheyAre() {
    tracker.report(Progress("start", 0, null))
    tracker.report(Progress("measure", 3, 6))
    assertEquals(listOf(Progress("start", 0, null), Progress("measure", 3, 6)), seen)
    assertNull(tracker.step)
  }
}
