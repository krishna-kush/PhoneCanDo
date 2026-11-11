package com.phonecando.network.retry

import com.phonecando.network.NetException
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class RetryPolicyTest {
    private val policy = RetryPolicy.DOWNLOAD

    @Test
    fun `network trouble is retried, the rest is not`() {
        assertTrue(RetryPolicy.retryable(NetException.Network("https://cdn/x", null)))
        assertTrue(RetryPolicy.retryable(NetException.RateLimited("https://cdn/x")))
        assertFalse(RetryPolicy.retryable(NetException.DigestMismatch("x", "a", "b")))
        assertFalse(RetryPolicy.retryable(NetException.AccessDenied("x", "https://hub/x", 403)))
        assertFalse(RetryPolicy.retryable(NetException.Cancelled()))
        assertFalse(RetryPolicy.retryable(IllegalStateException("bug")))
    }

    @Test
    fun `an engine's error counts by the one it keeps as its cause`() {
        assertTrue(RetryPolicy.retryable(IllegalStateException("mapped", NetException.Network("https://cdn/x", 503))))
        assertTrue(RetryPolicy.rateLimited(IllegalStateException("mapped", NetException.RateLimited("https://cdn/x"))))
    }

    @Test
    fun `a 4xx is the server's answer, but for a timeout and a CDN's 401 or 403`() {
        fun status(code: Int) = RetryPolicy.retryable(NetException.Network("https://cdn/x", code))
        assertTrue(status(500))
        assertTrue(status(503))
        assertTrue(status(408))
        assertTrue(status(403))
        assertFalse(status(400))
        assertFalse(status(405))
    }

    @Test
    fun `waits grow, then it gives up`() {
        val waits = (1..policy.maxAttempts).map { policy.delayMillis(it)!! }
        assertEquals(waits.sorted(), waits)
        assertEquals(2_000L, waits.first())
        assertNull(policy.delayMillis(policy.maxAttempts + 1))
        assertNull(policy.delayMillis(0))
    }

    @Test
    fun `a rate limit waits as long as the server asks, within reason`() {
        val asked = NetException.RateLimited("https://cdn/x", retryAfterSeconds = 90)
        assertEquals(90_000L, policy.delayMillis(1, asked))
        assertEquals(120_000L, policy.delayMillis(6, asked))
        val greedy = NetException.RateLimited("https://cdn/x", retryAfterSeconds = 86_400)
        assertEquals(RetryPolicy.MAX_RETRY_AFTER_MS, policy.delayMillis(1, greedy))
        assertEquals(2_000L, policy.delayMillis(1, NetException.RateLimited("https://cdn/x")))
    }
}
