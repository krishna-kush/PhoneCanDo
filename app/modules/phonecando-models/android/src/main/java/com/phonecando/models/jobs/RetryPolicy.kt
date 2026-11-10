package com.phonecando.models.jobs

import com.phonecando.lme.api.LmeException

/**
 * When a download tries again by itself: after a dropped connection, a
 * server error or a rate limit, waiting longer each time, up to
 * [MAX_ATTEMPTS] in a row. A try that brought new bytes starts the count
 * over, so a flaky network never gives up while it makes progress. What
 * arrived stays in the `.part` file; the next try resumes it with `Range`.
 * Pure.
 */
object RetryPolicy {
  private val DELAYS_MS = listOf(2_000L, 5_000L, 15_000L, 30_000L, 60_000L, 120_000L)
  val MAX_ATTEMPTS = DELAYS_MS.size

  fun retryable(e: Throwable): Boolean = e is LmeException.Network || e is LmeException.RateLimited

  /** The wait before try [attempt] (from 1) of a run of failures; null once they are used up. */
  fun delayMillis(attempt: Int): Long? = DELAYS_MS.getOrNull(attempt - 1)
}
