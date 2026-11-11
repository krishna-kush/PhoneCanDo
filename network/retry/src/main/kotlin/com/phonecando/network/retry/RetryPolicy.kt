package com.phonecando.network.retry

import com.phonecando.network.NetException

/**
 * When a failure is worth another try, and how long to wait first:
 * [delaysMillis] before each try of a run of failures (more failures than
 * waits, and it gives up), or as long as the server asks (`RateLimit`,
 * `Retry-After`) up to [MAX_RETRY_AFTER_MS] when that is longer. An
 * engine's own error counts by the [NetException] it keeps as its cause.
 * Pure.
 */
class RetryPolicy(private val delaysMillis: List<Long>) {
    val maxAttempts: Int get() = delaysMillis.size

    /** The wait before try [attempt] (from 1) of a run of failures, the last being [e]; null once they are used up. */
    fun delayMillis(attempt: Int, e: Throwable? = null): Long? {
        val ours = delaysMillis.getOrNull(attempt - 1) ?: return null
        val asked = (e?.let(NetException::of) as? NetException.RateLimited)?.retryAfterSeconds
            ?.let { minOf(it * 1000, MAX_RETRY_AFTER_MS) } ?: 0
        return maxOf(ours, asked)
    }

    companion object {
        /** A whole download, tried again by its job: a flaky network never gives up while it makes progress. */
        val DOWNLOAD = RetryPolicy(listOf(2_000L, 5_000L, 15_000L, 30_000L, 60_000L, 120_000L))

        const val MAX_RETRY_AFTER_MS = 15 * 60_000L

        /** How long a job waits for a network before it stops (and a later start resumes it: [ResumeList]). */
        const val MAX_OFFLINE_MS = 30 * 60_000L

        // A 4xx is the server's answer and stays the same, but for a timeout (408, 425) and a 401 or 403
        // from the CDN a redirect took us to (errorFor makes only those a Network error).
        private val RETRIED_4XX = setOf(401, 403, 408, 425)

        /** A dropped connection, a server error or a rate limit: another try may go through. */
        fun retryable(e: Throwable): Boolean = when (val n = NetException.of(e)) {
            is NetException.RateLimited -> true
            is NetException.Network -> n.status.let { it == null || it !in 400..499 || it in RETRIED_4XX }
            else -> false
        }

        fun rateLimited(e: Throwable): Boolean = NetException.of(e) is NetException.RateLimited
    }
}
