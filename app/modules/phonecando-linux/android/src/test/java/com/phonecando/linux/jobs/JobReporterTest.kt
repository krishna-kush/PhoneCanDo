package com.phonecando.linux.jobs

import com.phonecando.lre.api.Progress
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// JVM checks for progress events: throttling, the final event, the JS shape.
class JobReporterTest {
  private var clock = 0L
  private val events = ArrayList<ProgressEvent>()
  private val job = Job("job-7", JobTarget.image("a1b2c3"))
  private val reporter = JobReporter(job, { events += it }, ProgressThrottle(200) { clock })

  @Test fun reportsAreThrottledButEveryNewStepPasses() {
    reporter.report(Progress("unpack", 1, 100))
    reporter.report(Progress("unpack", 2, 100))
    clock += 250
    reporter.report(Progress("unpack", 3, 100))
    reporter.report(Progress("detect", 3, 6))
    assertEquals(listOf(1L, 3L, 3L), events.map { it.done })
    assertEquals(listOf("unpack", "unpack", "detect"), events.map { it.step })
  }

  @Test fun theFinalEventAlwaysGoesOutWithTheLastProgress() {
    reporter.report(Progress("download", 10, 50))
    reporter.report(Progress("download", 20, 50))
    reporter.finish("network: network error on https://x", "network")
    val last = events.last()
    assertTrue(last.finished)
    assertEquals(20L, last.done)
    assertEquals("network", last.errorCode)
    assertEquals("network: network error on https://x", last.error)
  }

  @Test fun aSuccessfulJobEndsWithoutError() {
    reporter.start()
    reporter.finish(null, null)
    assertNull(events.last().error)
    assertEquals(JobReporter.START, events.last().step)
  }

  @Test fun theEventHasTheLinuxProgressShape() {
    reporter.report(Progress("unpack", 5, null))
    val map = events.single().toMap()
    assertEquals(setOf("jobId", "target", "step", "done", "total", "error", "errorCode", "finished"), map.keys)
    assertEquals(mapOf("kind" to "image", "id" to "a1b2c3"), map["target"])
    assertEquals("job-7", map["jobId"])
    assertNull(map["total"])
  }
}
