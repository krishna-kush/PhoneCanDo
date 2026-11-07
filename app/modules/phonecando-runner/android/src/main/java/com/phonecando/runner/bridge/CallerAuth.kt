package com.phonecando.runner.bridge

import com.phonecando.runner.agents.AgentDirectory
import com.phonecando.runner.agents.AgentRecord
import java.security.MessageDigest

// Who is calling: every engine gets its own bridge token at launch, so the
// bearer names the agent. Each candidate is compared in constant time and
// the loop never stops early, so the reply time says nothing about which
// token (or how much of one) matched. Pure.
object CallerAuth {
  fun bearer(header: String?): String? =
    header?.takeIf { it.startsWith(PREFIX) }?.substring(PREFIX.length)?.takeIf { it.isNotEmpty() }

  /** The calling agent, or null for a missing or unknown token (401). */
  fun caller(header: String?, agents: AgentDirectory): AgentRecord? {
    val provided = bearer(header)?.toByteArray() ?: return null
    var match: AgentRecord? = null
    for (agent in agents.all()) {
      if (agent.bridgeToken.isEmpty()) continue
      val same = MessageDigest.isEqual(agent.bridgeToken.toByteArray(), provided)
      if (same && match == null) match = agent
    }
    return match
  }

  private const val PREFIX = "Bearer "
}
