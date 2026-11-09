package com.phonecando.runner.bridge.mcp

import java.net.URI

// The Streamable HTTP header rule /mcp enforces: a page in a browser must
// not reach the bridge (DNS rebinding), so an Origin, when sent, must be
// loopback; engines send none. MCP-Protocol-Version is not checked: we
// answer every version the same (McpVersion), and a client probing a newer
// one first (Claude Code's server/discover) must get -32601, not a 400.
// Pure.
object McpHeaders {
  private val LOOPBACK = setOf("127.0.0.1", "localhost", "[::1]", "::1")

  fun originAllowed(origin: String?): Boolean {
    if (origin == null) return true
    val host = try {
      URI(origin).host
    } catch (_: Exception) {
      null
    }
    return host != null && host.lowercase() in LOOPBACK
  }
}
