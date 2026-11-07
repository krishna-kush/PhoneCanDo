package com.phonecando.lre.oci.registry

import com.phonecando.lre.api.CancelSignal
import com.phonecando.lre.api.LreException

/**
 * How often we retry one registry host on a 5xx or a dropped connection
 * before moving to the next mirror, with doubling, capped pauses. A 429 is
 * never retried on the same host (its window is an hour).
 */
class RetryPolicy(
    val attemptsPerHost: Int = 3,
    val baseDelayMillis: Long = 1_000,
    val maxDelayMillis: Long = 8_000,
    /** Blocks for the given milliseconds; tests pass a recorder. */
    val sleeper: (Long) -> Unit = { Thread.sleep(it) },
) {
    init {
        require(attemptsPerHost >= 1) { "attemptsPerHost must be at least 1" }
    }

    /** Pause before retry number [attempt] (1-based): base, 2x base, ... up to the cap. */
    internal fun delayFor(attempt: Int): Long {
        val shift = (attempt - 1).coerceIn(0, 20)
        return minOf(maxDelayMillis, baseDelayMillis shl shift)
    }

    /** Sleeps [delayFor] in short slices so a cancel (or a thread interrupt) lands quickly. */
    internal fun pause(attempt: Int, cancel: CancelSignal) {
        var left = delayFor(attempt)
        while (left > 0) {
            if (cancel.isCancelled()) throw LreException.Cancelled()
            val slice = minOf(left, SLICE_MILLIS)
            try {
                sleeper(slice)
            } catch (e: InterruptedException) {
                Thread.currentThread().interrupt()
                throw LreException.Cancelled()
            }
            left -= slice
        }
        if (cancel.isCancelled()) throw LreException.Cancelled()
    }

    companion object {
        private const val SLICE_MILLIS = 250L

        val DEFAULT = RetryPolicy()
    }
}
