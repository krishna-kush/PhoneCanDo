package com.phonecando.runner.engine

import com.phonecando.runner.agents.AgentDirectory
import com.phonecando.runner.agents.AgentRecord

// The agents the bridge answers: those whose engine is starting or ready.
// The store keeps every agent, so on its own a stopped agent's token would
// still work and the screen it leased would stay with it for the full idle
// time (ScreenLease frees a lease whose holder is no longer here). Pure:
// `live` says whether an agent's engine runs.
internal class LiveAgents(
  private val agents: AgentDirectory,
  private val live: (agentId: String) -> Boolean,
) : AgentDirectory {
  override fun all(): List<AgentRecord> = agents.all().filter { live(it.id) }

  override fun get(id: String): AgentRecord? = agents.get(id)?.takeIf { live(it.id) }

  override fun byBridgeToken(token: String): AgentRecord? = agents.byBridgeToken(token)?.takeIf { live(it.id) }
}
