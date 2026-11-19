package com.phonecando.runner.engine.acp

// Our own tools (the bridge's MCP server, AcpWire.MCP_NAME) never wait on
// an agent's own approval: the phone-control lock is their check, so an
// ACP agent's permission question about one is answered allow-once here
// and never reaches you. A question is ours only when its tool call's
// title is one of our tool names, bare or with our server's name round it
// as agents write it (mcp__phonecando__x, phonecando/x, phonecando.x,
// phonecando:x, "x (phonecando MCP Server)"); a shell command or anything
// else that merely mentions one still asks. Allow-once keeps the agent's
// own saved rules as they were. Pure.
internal object OwnTools {
  private val server = Regex.escape(AcpWire.MCP_NAME)
  private val wrapped = listOf(
    Regex("^mcp__${server}__(.+)$"),
    Regex("^$server[/.:](.+)$"),
    Regex("^(.+?) \\($server(?: MCP Server)?\\)$", RegexOption.IGNORE_CASE),
  )

  /** [title] (a permission question's tool call) names one of [names]. */
  fun isOurs(title: String, names: Set<String>): Boolean {
    val t = title.trim()
    if (t in names) return true
    return wrapped.any { r -> r.find(t)?.groupValues?.get(1)?.trim()?.let { it in names } == true }
  }

  /** The option that allows it this once (else always); null when it offers no allow. */
  fun allow(options: List<AcpOption>): AcpOption? =
    options.firstOrNull { it.kind == ALLOW_ONCE } ?: options.firstOrNull { it.kind == ALLOW_ALWAYS }

  private const val ALLOW_ONCE = "allow_once"
  private const val ALLOW_ALWAYS = "allow_always"
}
