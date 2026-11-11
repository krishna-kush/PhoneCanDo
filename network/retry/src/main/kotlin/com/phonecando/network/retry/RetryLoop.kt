package com.phonecando.network.retry

import com.phonecando.network.CancelSignal

/** A job's wait before it tries again: try [attempt] of [max], in [delayMillis], after [reason]. */
data class RetryWait(val attempt: Int, val max: Int, val delayMillis: Long, val reason: Reason) {
    enum class Reason { NETWORK, RATE_LIMITED }
}

/** What a job's tries tell its user. */
interface RetrySink {
    /** The most bytes any try said were done: a try that brought more starts the count over. */
    val mostDone: Long

    fun retrying(wait: RetryWait)

    fun waitingForNetwork()
}

/**
 * Runs a job's tries under [policy]. A failure it may retry waits and tries
 * again; a try that brought new bytes starts the count over. A failure while
 * the phone has no network does not count: the job waits for one (checking
 * every [pollMillis], up to RetryPolicy.MAX_OFFLINE_MS) and tries at once.
 * Pure: the network, the clock and the sleep are parameters.
 */
class RetryLoop(
    private val online: () -> Boolean,
    private val policy: RetryPolicy = RetryPolicy.DOWNLOAD,
    private val now: () -> Long = System::currentTimeMillis,
    private val pollMillis: Long = 1_000,
    private val sleeper: (Long) -> Unit = Thread::sleep,
) {
    /** Runs [tryOnce] until it succeeds, fails for good, or [cancel] is set (NetException.Cancelled). */
    fun run(sink: RetrySink, cancel: CancelSignal, tryOnce: () -> Unit) {
        var attempt = 0
        var doneBefore = -1L
        while (true) {
            try {
                tryOnce()
                return
            } catch (e: Exception) {
                if (!RetryPolicy.retryable(e) || cancel.isCancelled()) throw e
                if (!online()) {
                    awaitNetwork(sink, cancel, e)
                    continue
                }
                if (sink.mostDone > doneBefore) attempt = 0
                doneBefore = sink.mostDone
                attempt++
                val delay = policy.delayMillis(attempt, e) ?: throw e
                val reason = if (RetryPolicy.rateLimited(e)) RetryWait.Reason.RATE_LIMITED else RetryWait.Reason.NETWORK
                sink.retrying(RetryWait(attempt, policy.maxAttempts, delay, reason))
                Waits.sleep(delay, cancel, sleeper)
            }
        }
    }

    // Gives up with [cause] when no network came back in time.
    private fun awaitNetwork(sink: RetrySink, cancel: CancelSignal, cause: Exception) {
        sink.waitingForNetwork()
        val until = now() + RetryPolicy.MAX_OFFLINE_MS
        while (!online()) {
            if (now() >= until) throw cause
            Waits.sleep(pollMillis, cancel, sleeper)
        }
    }
}
