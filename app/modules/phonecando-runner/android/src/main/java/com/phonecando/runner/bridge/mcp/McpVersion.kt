package com.phonecando.runner.bridge.mcp

// The MCP protocol versions initialize agrees on. Our server is stateless
// and serves tools only, so it behaves the same under each: a version the
// client asks for that we know is echoed, any other gets our latest (MCP
// lifecycle, version negotiation; a client that cannot speak it
// disconnects). Pure.
object McpVersion {
  val SUPPORTED = listOf("2025-11-25", "2025-06-18", "2025-03-26")
  val LATEST = SUPPORTED.first()

  fun negotiate(requested: Any?): String = (requested as? String)?.takeIf { it in SUPPORTED } ?: LATEST
}
