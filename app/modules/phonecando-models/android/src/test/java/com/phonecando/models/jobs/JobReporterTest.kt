package com.phonecando.models.jobs

import com.phonecando.network.Progress
import com.phonecando.network.retry.RetryWait
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class JobReporterTest {
  private var t = 0L
  private val events = ArrayList<Map<String, Any?>>()
  private val job = ModelJob("model-job-1", JobTarget(JobTarget.Kind.DOWNLOAD, "qwen"), "Qwen3.5 4B")
  private val reporter = JobReporter(job, { events += it }, intervalMillis = 250, now = { t })

  @Test
  fun `events are throttled within a step, a new step passes`() {
    reporter.report(Progress("verify", 10, 100))
    t = 100
    reporter.report(Progress("verify", 20, 100))
    reporter.report(Progress("download", 20, 100))
    t = 400
    reporter.report(Progress("download", 30, 100))
    assertEquals(listOf("verify", "download", "download"), events.map { it["step"] })
    assertEquals(30L, job.done)
  }

  @Test
  fun `transfer bytes have a rate, verifying has none`() {
    reporter.report(Progress("verify", 50, 100))
    assertNull(events.last()["rateBytesPerSec"])
    reporter.report(Progress("download", 50, 100))
    t = 1_000
    reporter.report(Progress("download", 60, 100))
    assertEquals(10.0, events.last()["rateBytesPerSec"])
    assertEquals(60L, reporter.mostDone)
  }

  @Test
  fun `a retry is one event, and the last event says how it ended`() {
    reporter.report(Progress("download", 5, 100))
    reporter.retrying(RetryWait(2, 6, 5_000, RetryWait.Reason.RATE_LIMITED))
    assertEquals("retry", events.last()["step"])
    assertEquals(mapOf("attempt" to 2, "max" to 6, "delaySec" to 5, "reason" to "rate_limited"), events.last()["retry"])
    reporter.finish("network error on https://cdn/x", "network")
    val last = events.last()
    assertEquals(true, last["finished"])
    assertEquals(false, last["ok"])
    assertEquals("network", last["errorCode"])
    assertEquals("download", last["step"])
    assertEquals(mapOf("kind" to "download", "id" to "qwen"), last["target"])
  }

  @Test
  fun `a wait for a network is one event until bytes come again`() {
    reporter.report(Progress("download", 5, 100))
    reporter.waitingForNetwork()
    assertEquals("offline", events.last()["step"])
    assertNull(events.last()["retry"])
    assertEquals(5.0, events.last()["done"])
    t = 1_000
    reporter.report(Progress("download", 6, 100))
    assertEquals("download", events.last()["step"])
  }
}
