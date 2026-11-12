package com.phonecando.linux.jobs

import com.phonecando.linux.errors.LinuxError
import com.phonecando.linux.errors.LinuxErrorCode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import kotlin.concurrent.thread

// JVM checks for the running-job registry: one job per target, cancel, end.
class JobRegistryTest {
  private val registry = JobRegistry()

  @Test fun oneJobPerTarget() {
    registry.begin(JobTarget.image("a"))
    try {
      registry.begin(JobTarget.image("a"))
      fail("a second job for the same image must be refused")
    } catch (e: LinuxError) {
      assertEquals(LinuxErrorCode.BUSY, e.code)
    }
    // Another image, or an env with the same id, is another target.
    registry.begin(JobTarget.image("b"))
    registry.begin(JobTarget.env("a"))
  }

  @Test fun endingAJobFreesItsTarget() {
    val first = registry.begin(JobTarget.env("e"))
    registry.end(first)
    assertFalse(registry.isLive(JobTarget.env("e")))
    val second = registry.begin(JobTarget.env("e"))
    assertNotEquals(first.id, second.id)
    assertTrue(registry.isLive(JobTarget.env("e")))
  }

  @Test fun runningListsTheLiveJobs() {
    assertFalse(registry.anyRunning())
    val env = registry.begin(JobTarget.env("e"))
    val script = registry.begin(JobTarget.image("a"), guestScript = true)
    assertTrue(registry.anyRunning())
    assertEquals(setOf(env.id, script.id), registry.running().map { it.id }.toSet())
    registry.end(env)
    registry.end(script)
    assertFalse(registry.anyRunning())
    assertTrue(registry.running().isEmpty())
  }

  @Test fun cancelSetsTheSignalTheRuntimePolls() {
    val job = registry.begin(JobTarget.image("a"))
    assertFalse(job.cancel.isCancelled())
    assertTrue(registry.cancel(job.id))
    assertTrue(job.cancel.isCancelled())
    assertFalse(registry.cancel("job-unknown"))
  }

  @Test fun anEndedJobCannotBeCancelled() {
    val job = registry.begin(JobTarget.image("a"))
    registry.end(job)
    assertFalse(registry.cancel(job.id))
    assertNull(registry.live(JobTarget.image("a")))
  }

  @Test fun cancelAndAwaitWaitsForTheJobToEnd() {
    val job = registry.begin(JobTarget.image("a"))
    val worker = thread {
      while (!job.cancel.isCancelled()) Thread.sleep(5)
      registry.end(job)
    }
    registry.cancelAndAwait(JobTarget.image("a"), 5_000)
    worker.join()
    assertFalse(registry.isLive(JobTarget.image("a")))
  }

  @Test fun cancelAndAwaitGivesUpAsBusy() {
    registry.begin(JobTarget.image("stuck"))
    try {
      registry.cancelAndAwait(JobTarget.image("stuck"), 20)
      fail("a job that ignores cancel must leave the target busy")
    } catch (e: LinuxError) {
      assertEquals(LinuxErrorCode.BUSY, e.code)
    }
  }

  @Test fun cancelAndAwaitWithNoJobReturnsAtOnce() {
    registry.cancelAndAwait(JobTarget.env("none"), 0)
  }
}
