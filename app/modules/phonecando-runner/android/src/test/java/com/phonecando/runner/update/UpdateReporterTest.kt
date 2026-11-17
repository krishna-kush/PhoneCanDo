package com.phonecando.runner.update

import com.phonecando.network.Progress
import com.phonecando.network.retry.RetryWait
import org.junit.Assert.assertEquals
import org.junit.Test

// The events a download sends: a new step at once, bytes about 4 a second,
// the end always; only download bytes count as progress for retries.
class UpdateReporterTest {
  private val spec = UpdateSpec(SpecRules.RELEASES + "v1/a.apk", "a.apk", 1_000, "ab".repeat(32), 7, "1.0.1")
  private var clock = 0L
  private val sent = mutableListOf<UpdateState>()
  private val reporter = UpdateReporter(spec, 300, { sent += it }, now = { clock })

  @Test fun itStartsFromWhatAnEarlierTryLeft() {
    reporter.start()
    assertEquals(UpdateState(spec, UpdateStep.DOWNLOAD, 300), sent.single())
  }

  @Test fun bytesOfOneStepAreThrottled() {
    reporter.start()
    reporter.report(Progress("verify", 100, 300))
    clock += 100
    reporter.report(Progress("verify", 200, 300))
    clock += 100
    reporter.report(Progress("verify", 300, 300))
    // A new step goes at once, whatever the clock says.
    reporter.report(Progress("download", 300, 1_000))
    clock += 300
    reporter.report(Progress("download", 600, 1_000))
    assertEquals(listOf("download", "verify", "download", "download"), sent.map { it.step.wire })
    assertEquals(600L, sent.last().written)
    // The last state is there even when unsent.
    reporter.report(Progress("download", 700, 1_000))
    assertEquals(700L, reporter.current.written)
    assertEquals(4, sent.size)
  }

  @Test fun waitsGoAtOnce() {
    reporter.report(Progress("download", 500, 1_000))
    reporter.retrying(RetryWait(1, 6, 2_000, RetryWait.Reason.NETWORK))
    reporter.waitingForNetwork()
    assertEquals(listOf("download", "retry", "offline"), sent.map { it.step.wire })
    // A wait keeps the bytes so far.
    assertEquals(500L, sent.last().written)
  }

  @Test fun theEndAlwaysGoes() {
    reporter.report(Progress("download", 1_000, 1_000))
    reporter.end(UpdateState(spec, UpdateStep.DONE, 1_000, "/x/a.apk"))
    assertEquals(UpdateStep.DONE, sent.last().step)
  }

  @Test fun onlyDownloadBytesAreProgress() {
    reporter.report(Progress("verify", 900, 900))
    assertEquals(0L, reporter.mostDone)
    reporter.report(Progress("download", 950, 1_000))
    reporter.report(Progress("download", 920, 1_000))
    assertEquals(950L, reporter.mostDone)
  }
}
