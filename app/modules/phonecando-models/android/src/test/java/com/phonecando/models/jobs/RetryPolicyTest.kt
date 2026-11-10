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
  fun `waits grow, then it gives up`() {
    val waits = (1..RetryPolicy.MAX_ATTEMPTS).map { RetryPolicy.delayMillis(it)!! }
    assertEquals(waits.sorted(), waits)
    assertEquals(2_000L, waits.first())
    assertNull(RetryPolicy.delayMillis(RetryPolicy.MAX_ATTEMPTS + 1))
    assertNull(RetryPolicy.delayMillis(0))
  }
}
