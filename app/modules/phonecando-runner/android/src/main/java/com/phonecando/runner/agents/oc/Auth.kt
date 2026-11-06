package com.phonecando.runner.agents.oc

import java.util.Base64

// opencode v2 serve is auth-first: every REST, SSE and TUI call sends HTTP
// Basic with the server password (OPENCODE_SERVER_PASSWORD) under the fixed
// user `opencode` (an upstream name; never rename it).
internal object Auth {
  private const val USER = "opencode"

  fun credential(password: String): String =
    Base64.getEncoder().encodeToString("$USER:$password".toByteArray(Charsets.UTF_8))

  fun headers(password: String): Map<String, String> =
    mapOf("Authorization" to "Basic ${credential(password)}")
}
