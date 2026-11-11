package com.phonecando.models.jobs

import com.phonecando.lme.api.LmeException

/** What a download's tries tell the user (JobReporter). */
interface RetrySink {
  /** The most bytes any try said were done. */
  val mostDone: Long

  fun retrying(wait: RetryWait)

  fun waitingForNetwork()
}

/**
 * Runs a download's tries under RetryPolicy. A failure it may retry waits
 * and tries again; a try that brought new bytes starts the count over. A
 * failure while the phone has no network does not count: the job waits for
 * one (checking every [pollMillis], up to RetryPolicy.MAX_OFFLINE_MS) and
 * tries at once. Pure: the network, the clock and the wait are parameters,
 * and the wait throws when the job is cancelled.
 */
class RetryLoop(
  private val online: () -> Boolean,
  private val now: () -> Long = System::currentTimeMillis,
  private val pollMillis: Long = 1_000,
) {
  fun run(sink: RetrySink, cancelled: () -> Boolean, sleep: (Long) -> Unit, tryOnce: () -> Unit) {
    var attempt = 0
    var doneBefore = -1L
    while (true) {
      try {
        tryOnce()
        return
      } catch (e: LmeException) {
        if (!RetryPolicy.retryable(e) || cancelled()) throw e
        if (!online()) {
          awaitNetwork(sink, sleep, e)
          continue
        }
        if (sink.mostDone > doneBefore) attempt = 0
        doneBefore = sink.mostDone
        attempt++
        val delay = RetryPolicy.delayMillis(attempt, e) ?: throw e
        sink.retrying(RetryWait(attempt, RetryPolicy.MAX_ATTEMPTS, delay))
        sleep(delay)
      }
    }
  }

  // Gives up with [cause] when no network came back in time.
  private fun awaitNetwork(sink: RetrySink, sleep: (Long) -> Unit, cause: LmeException) {
    sink.waitingForNetwork()
    val until = now() + RetryPolicy.MAX_OFFLINE_MS
    while (!online()) {
      if (now() >= until) throw cause
      sleep(pollMillis)
    }
  }
}
