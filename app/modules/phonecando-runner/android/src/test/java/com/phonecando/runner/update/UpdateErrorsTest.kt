package com.phonecando.runner.update

import com.phonecando.network.NetException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

// A failure as JS reads it: a short code, and one line that starts with it.
class UpdateErrorsTest {
  @Test fun networkFailuresKeepTheirKind() {
    assertEquals("network", UpdateErrors.codeOf(NetException.Network("https://github.com/x", null)))
    assertEquals("not_found", UpdateErrors.codeOf(NetException.NotFound("a.apk")))
    assertEquals("digest_mismatch", UpdateErrors.codeOf(NetException.DigestMismatch("a.apk", "aa", "bb")))
    assertEquals("size_mismatch", UpdateErrors.codeOf(NetException.SizeMismatch("a.apk", 1, 2)))
    // Wrapped, the cause still counts.
    assertEquals("rate_limited", UpdateErrors.codeOf(RuntimeException("x", NetException.RateLimited("u"))))
  }

  @Test fun diskAndOurOwnFailures() {
    assertEquals("no_space", UpdateErrors.codeOf(IOException("write failed: ENOSPC (No space left on device)")))
    assertEquals("storage", UpdateErrors.codeOf(IOException("could not replace update-download.json")))
    assertEquals("busy", UpdateErrors.codeOf(UpdateError(UpdateErrors.BUSY, "the last download did not stop in time")))
    assertEquals("internal", UpdateErrors.codeOf(IllegalStateException()))
  }

  @Test fun theLineIsOneLineAndStartsWithTheCode() {
    val line = UpdateErrors.lineOf(IOException("first\nsecond"))
    assertEquals("storage: first second", line)
    val long = UpdateErrors.lineOf(NetException.BadAnswer("x".repeat(1_000)))
    assertTrue(long.startsWith("bad_answer: "))
    assertTrue(long.length <= 300)
    assertFalse('\n' in long)
  }
}
