package com.phonecando.runner.prompts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// JVM checks for which links an agent may ask the phone to open, and the
// host the prompt names.
class OpenUrlTest {
  @Test fun httpAndHttpsWithAHost() {
    assertEquals("github.com", OpenUrl.hostOf("https://github.com/login/device"))
    assertEquals("claude.ai", OpenUrl.hostOf("https://claude.ai/oauth/authorize?code=true&redirect_uri=https%3A%2F%2Fx"))
    assertEquals("localhost", OpenUrl.hostOf("http://localhost:8080/callback"))
    assertEquals("example.com", OpenUrl.hostOf("https://example.com"))
    assertEquals("example.com", OpenUrl.hostOf("https://example.com#frag"))
    assertEquals("[::1]", OpenUrl.hostOf("http://[::1]:9000/"))
  }

  @Test fun theHostIsWhereItGoes() {
    assertEquals("evil.example", OpenUrl.hostOf("https://good.example@evil.example/login"))
    assertEquals("evil.example", OpenUrl.hostOf("https://user:pw@evil.example:443/"))
  }

  @Test fun everythingElseIsRefused() {
    for (url in listOf(
      "javascript:alert(1)",
      "file:///data/data/x",
      "intent://scan#Intent;end",
      "HTTPS://example.com",
      "ftp://example.com",
      "https://",
      "https:///path",
      "https://exa mple.com",
      "https://example.com/\u0007",
      "https://exa_mple.com",
      " https://example.com",
      "https://...",
    )) {
      assertNull(url, OpenUrl.hostOf(url))
    }
  }

  @Test fun atMostTwoKiB() {
    val base = "https://example.com/"
    assertEquals("example.com", OpenUrl.hostOf(base + "a".repeat(OpenUrl.MAX_BYTES - base.length)))
    assertNull(OpenUrl.hostOf(base + "a".repeat(OpenUrl.MAX_BYTES - base.length + 1)))
    // Bytes, not characters.
    assertNull(OpenUrl.hostOf(base + "é".repeat((OpenUrl.MAX_BYTES - base.length) / 2 + 1)))
  }
}
