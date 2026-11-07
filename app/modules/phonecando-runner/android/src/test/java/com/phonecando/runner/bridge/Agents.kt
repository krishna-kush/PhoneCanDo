package com.phonecando.runner.bridge

import com.phonecando.runner.agents.AgentDirectory
import com.phonecando.runner.agents.AgentRecord

// Test agents: an in-memory directory that tests can shrink to model an
// engine leaving it.
fun agent(id: String, name: String = id, token: String = "token-$id") =
  AgentRecord(id, "opencode", name, "img-$id", null, "pw-$id", token, 0L)

class FakeDirectory(vararg agents: AgentRecord) : AgentDirectory {
  val records = agents.toMutableList()

  override fun all(): List<AgentRecord> = records.toList()

  override fun get(id: String): AgentRecord? = records.firstOrNull { it.id == id }

  override fun byBridgeToken(token: String): AgentRecord? = records.firstOrNull { it.bridgeToken == token }
}
