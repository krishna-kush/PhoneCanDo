package com.phonecando.models.jobs

import com.phonecando.models.errors.ModelError
import com.phonecando.models.errors.ModelErrorCode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelJobsTest {
  private var t = 0L
  private val jobs = ModelJobs(tickMillis = 2_000, now = { t })
  private val heard = ArrayList<Int>()

  init {
    jobs.addListener { heard += jobs.running().size }
  }

  private val target = JobTarget(JobTarget.Kind.DOWNLOAD, "qwen")

  @Test
  fun `one job per target, freed at its end`() {
    val job = jobs.begin(target, "Qwen")
    assertSame(job, jobs.live(target))
    val e = assertThrows(ModelError::class.java) { jobs.begin(target, "Qwen") }
    assertEquals(ModelErrorCode.BUSY, e.code)
    jobs.end(job)
    assertNull(jobs.live(target))
    assertTrue(job.await(0))
    assertEquals(listOf(1, 0), heard)
  }

  @Test
  fun `cancel by job id`() {
    val job = jobs.begin(target, "Qwen")
    assertFalse(jobs.cancel("model-job-99"))
    assertTrue(jobs.cancel(job.id))
    assertTrue(job.cancel.isCancelled())
  }

  @Test
  fun `cancel and await gives up on a job that hangs`() {
    jobs.begin(target, "Qwen")
    val e = assertThrows(ModelError::class.java) { jobs.cancelAndAwait(target, 10) }
    assertEquals(ModelErrorCode.BUSY, e.code)
    jobs.cancelAndAwait(JobTarget(JobTarget.Kind.IMPORT, "none"), 10)
  }

  @Test
  fun `progress is heard at most every tick`() {
    val job = jobs.begin(target, "Qwen")
    heard.clear()
    jobs.progressed(job)
    t = 1_000
    jobs.progressed(job)
    t = 2_000
    jobs.progressed(job)
    assertEquals(2, heard.size)
  }
}
