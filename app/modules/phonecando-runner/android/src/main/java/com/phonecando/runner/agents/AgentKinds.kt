package com.phonecando.runner.agents

import com.phonecando.runner.agents.oc.OpencodeKind

// Every agent kind this build can run. Adding a kind is a folder under
// agents/ plus one line here.
object AgentKinds {
  private val all: Map<String, AgentKind> = listOf<AgentKind>(OpencodeKind).associateBy { it.id }

  /** The kind a fresh install starts with. */
  val default: AgentKind = OpencodeKind

  fun get(id: String): AgentKind? = all[id]
}
