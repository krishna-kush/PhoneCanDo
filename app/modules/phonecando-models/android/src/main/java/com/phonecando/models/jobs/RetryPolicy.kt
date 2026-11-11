package com.phonecando.models.jobs

import com.phonecando.lme.api.LmeException

/**
 * When a download tries again by itself: after a dropped connection, a
 * server error or a rate limit, waiting longer each time (or as long as the
 * server's Retry-After asks, up to [MAX_RETRY_AFTER_MS]), up to
 * [MAX_ATTEMPTS] in a row. A try that brought new bytes starts the count
 * over, so a flaky network never gives up while it makes progress. With no
 * network at all the job waits for one, up to [MAX_OFFLINE_MS], without
 * counting (RetryLoop). What arrived stays in the `.part` file; the next try
 * resumes it with `Range`. Pure.
 */
object RetryPolicy {
  private val DELAYS_MS = listOf(2_000L, 5_000L, 15_000L, 30_000L, 60_000L, 120_000L)
  val MAX_ATTEMPTS = DELAYS_MS.size

  const val MAX_RETRY_AFTER_MS = 15 * 60_000L

  /** How long a job waits for a network before it stops; the next app start resumes it (ResumeList). */
  const val MAX_OFFLINE_MS = 30 * 60_000L

  // A 4xx is the server's answer and stays the same, but for a timeout (408, 425) and a 401 or 403
  // from the CDN a redirect took us to (lme's errorFor makes only those a Network error).
  private val RETRIED_4XX = setOf(401, 403, 408, 425)

  fun retryable(e: Throwable): Boolean = when (e) {
    is LmeException.RateLimited -> true
    is LmeException.Network -> e.status.let { it == null || it !in 400..499 || it in RETRIED_4XX }
    else -> false
  }

  /** The wait before try [attempt] (from 1) of a run of failures, the last being [e]; null once they are used up. */
  fun delayMillis(attempt: Int, e: Throwable? = null): Long? {
    val ours = DELAYS_MS.getOrNull(attempt - 1) ?: return null
    val asked = (e as? LmeException.RateLimited)?.retryAfterSeconds?.let { minOf(it * 1000, MAX_RETRY_AFTER_MS) } ?: 0
    return maxOf(ours, asked)
  }
}
