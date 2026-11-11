package com.phonecando.models.jobs

import com.phonecando.lme.api.LmeException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RetryPolicyTest {
  @Test
  fun `network trouble is retried, the rest is not`() {
    assertTrue(RetryPolicy.retryable(LmeException.Network("https://cdn/x", null)))
    assertTrue(RetryPolicy.retryable(LmeException.RateLimited("https://cdn/x")))
    assertFalse(RetryPolicy.retryable(LmeException.DigestMismatch("x", "a", "b")))
    assertFalse(RetryPolicy.retryable(LmeException.AccessDenied("x")))
    assertFalse(RetryPolicy.retryable(LmeException.Cancelled()))
  }

  @Test
  fun `a 4xx is the server's answer, but for a timeout and a CDN's 401 or 403`() {
    fun status(code: Int) = RetryPolicy.retryable(LmeException.Network("https://cdn/x", code))
    assertTrue(status(500))
    assertTrue(status(503))
    assertTrue(status(408))
    assertTrue(status(403))
    assertFalse(status(400))
    assertFalse(status(405))
  }

  @Test
  fun `a rate limit waits as long as the server asks, within reason`() {
    val asked = LmeException.RateLimited("https://cdn/x", retryAfterSeconds = 90)
    assertEquals(90_000L, RetryPolicy.delayMillis(1, asked))
    assertEquals(120_000L, RetryPolicy.delayMillis(6, asked))
    val greedy = LmeException.RateLimited("https://cdn/x", retryAfterSeconds = 86_400)
    assertEquals(RetryPolicy.MAX_RETRY_AFTER_MS, RetryPolicy.delayMillis(1, greedy))
    assertEquals(2_000L, RetryPolicy.delayMillis(1, LmeException.RateLimited("https://cdn/x")))
  }

  @Test
  fun `waits grow, then it gives up`() {
    val waits = (1..RetryPolicy.MAX_ATTEMPTS).map { RetryPolicy.delayMillis(it)!! }
    assertEquals(waits.sorted(), waits)
    assertEquals(2_000L, waits.first())
    assertNull(RetryPolicy.delayMillis(RetryPolicy.MAX_ATTEMPTS + 1))
    assertNull(RetryPolicy.delayMillis(0))
  }
}
