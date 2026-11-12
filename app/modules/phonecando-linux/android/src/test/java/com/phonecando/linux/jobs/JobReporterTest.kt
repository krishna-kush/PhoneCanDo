package com.phonecando.linux.jobs

import com.phonecando.network.Progress
import com.phonecando.network.retry.RetryWait
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

  @Test fun aScriptJobCarriesItsPhaseTailAndExitCodeToTheEnd() {
    reporter.reportScript(ScriptDetail("runtime:node", listOf("a"), null), Progress("script", 1, null))
    reporter.reportScript(ScriptDetail("runtime:node", listOf("a", "b"), null), Progress("script", 1, null))
    reporter.reportScript(ScriptDetail("packages", listOf("a", "b", "c"), null), Progress("script", 2, null))
    // The same phase within the interval is throttled; a new phase passes at once.
    assertEquals(listOf("runtime:node", "packages"), events.map { it.script?.phase })
    reporter.reportScript(ScriptDetail("packages", listOf("c", "E: no"), 100), Progress("script", 2, null))
    reporter.finish("command_failed: install exited with 100", "command_failed")
    assertEquals(
      setOf("phase", "tail", "exitCode", "retry", "elapsedSec", "downloadedBytes", "rateBytesPerSec", "online"),
      events.first().toMap().keys - events.first().copy(script = null).toMap().keys,
    )
    val last = events.last().toMap()
    assertEquals(false, last["ok"])
    assertEquals(100, last["exitCode"])
    assertEquals(listOf("c", "E: no"), last["tail"])
    assertEquals("packages", last["phase"])
  }

  @Test fun aNewRetryPassesAtOnce() {
    reporter.reportScript(ScriptDetail("install", listOf("a"), null), Progress("script", 1, null))
    reporter.reportScript(ScriptDetail("install", listOf("a"), null, ScriptRetry(2, 3)), Progress("script", 1, null))
    reporter.reportScript(ScriptDetail("install", listOf("a"), null, ScriptRetry(2, 3)), Progress("script", 1, null))
    reporter.reportScript(ScriptDetail("install", listOf("a"), null, ScriptRetry(3, 3)), Progress("script", 1, null))
    assertEquals(listOf(null, 2, 3), events.map { it.script?.retry?.attempt })
  }

  @Test fun aScriptEventCarriesRetryAndActivity() {
    val detail = ScriptDetail("install", emptyList(), null, ScriptRetry(2, 3), ScriptActivity(130, 120_000_000, 1_200_000, false))
    reporter.reportScript(detail, Progress("script", 1, null))
    val map = events.single().toMap()
    assertEquals(mapOf("attempt" to 2, "max" to 3), map["retry"])
    assertEquals(130L, map["elapsedSec"])
    assertEquals(120_000_000L, map["downloadedBytes"])
    assertEquals(1_200_000L, map["rateBytesPerSec"])
    assertEquals(false, map["online"])
  }

  @Test fun aScriptEventWithoutCountsSaysNull() {
    reporter.reportScript(ScriptDetail(null, emptyList(), null, null, ScriptActivity(4, null, null)), Progress("script", 0, null))
    val map = events.single().toMap()
    assertNull(map["retry"])
    assertNull(map["downloadedBytes"])
    assertNull(map["rateBytesPerSec"])
    assertNull(map["online"])
    assertEquals(4L, map["elapsedSec"])
  }

  @Test fun aDownloadWaitingToTryAgainSaysSoAtOnce() {
    reporter.report(Progress("download", 40, 100))
    reporter.retrying(RetryWait(2, 6, 5_000, RetryWait.Reason.RATE_LIMITED))
    val waiting = events.last()
    assertEquals("retry", waiting.step)
    assertEquals(40L, waiting.done)
    assertEquals(
      mapOf("attempt" to 2, "max" to 6, "delaySec" to 5, "reason" to "rate_limited"),
      waiting.toMap()["retry"],
    )
    reporter.waitingForNetwork()
    assertEquals("offline", events.last().step)
    assertNull(events.last().toMap()["retry"])
    // The next report is the download again, at once.
    reporter.report(Progress("download", 41, 100))
    assertEquals("download", events.last().step)
    assertEquals(false, events.last().toMap().containsKey("retry"))
  }

  @Test fun onlyDownloadedBytesCountAsATryGettingSomewhere() {
    reporter.report(Progress("verify", 90, 100))
    assertEquals(0L, reporter.mostDone)
    reporter.report(Progress("download", 30, 100))
    reporter.report(Progress("download", 10, 100))
    assertEquals(30L, reporter.mostDone)
  }

  @Test fun theLastEventOfAFailedWaitIsTheDownloadsOwn() {
    reporter.report(Progress("download", 40, 100))
    reporter.waitingForNetwork()
    reporter.finish("network: network error on https://x", "network")
    assertEquals("download", events.last().step)
    assertTrue(events.last().finished)
  }

  @Test fun aFinishedJobWithoutErrorIsOk() {
    reporter.finish(null, null)
    assertEquals(true, events.last().toMap()["ok"])
  }
}
