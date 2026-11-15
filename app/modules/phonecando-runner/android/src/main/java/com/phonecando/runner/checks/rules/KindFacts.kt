package com.phonecando.runner.checks.rules

import com.phonecando.agents.kit.Capability
import com.phonecando.agents.kit.manifest.AcpTools
import com.phonecando.agents.kit.manifest.InboxWake
import com.phonecando.agents.kit.manifest.PhoneTools
import com.phonecando.agents.kit.render.ManifestKind

// What the rules read of a kind's setting, as one engine life launched it.
// [declared] is per agent: `state` only when the agent keeps its own (the
// caller drops it otherwise). Pure.
internal data class KindFacts(
  val declared: Set<Capability>,
  /** Its tools come from an MCP server its setting starts (`phoneTools` mcp:config or mcp:argv), so it must reach us. */
  val toolsByMcp: Boolean = false,
  /** In ACP mode the tools go in its chat (`engine.acp.tools` session) or its config names them (toolsByMcp). */
  val acpToolsExpected: Boolean = false,
  /** `inbox.hooks`' events, in manifest order. */
  val hookEvents: List<String> = emptyList(),
  /** How an idle agent of it is woken (`inbox.wake`); null: never. */
  val wake: InboxWake? = null,
  /** Its messages go to its server (`inbox.server`). */
  val server: Boolean = false,
) {
  companion object {
    fun of(kind: ManifestKind, declared: Set<Capability>): KindFacts {
      val m = kind.manifest
      val mcp = m.phoneTools == PhoneTools.MCP_CONFIG || m.phoneTools == PhoneTools.MCP_ARGV
      return KindFacts(
        declared = declared,
        toolsByMcp = mcp,
        acpToolsExpected = m.engine?.acp?.tools == AcpTools.SESSION || mcp,
        hookEvents = m.inbox?.hooks?.keys?.toList().orEmpty(),
        wake = m.inbox?.wake,
        server = m.inbox?.server != null,
      )
    }
  }
}
