package com.phonecando.runner.messages

import com.phonecando.runner.agents.AgentRecord

// Who an agents_send `to` names, from [caller]'s side: "@machine" every
// other agent on its machine, "@phone" every other agent on the phone, else
// one agent by name (any case; a leading "@" is fine; "Name (Kind)", as a
// message's from= reads, too) or by id. A name two
// agents share is refused with both (and their ids, which always work);
// so is the caller itself, and a name nobody has, with who is there. Pure.
object Addressing {
  sealed interface Addressed

  data class One(val agent: AgentRecord) : Addressed

  /** A broadcast: [target] is Message.machine(..) or Message.PHONE. */
  data class Many(val target: String, val agents: List<AgentRecord>) : Addressed

  data class Refused(val reason: String) : Addressed

  const val MACHINE = "@machine"
  const val PHONE = "@phone"

  fun resolve(to: String, caller: AgentRecord, agents: List<AgentRecord>, kindLabel: (String) -> String): Addressed {
    val wanted = MessageText.oneLine(to, 200)
    val others = agents.filter { it.id != caller.id }
    when (wanted.lowercase()) {
      MACHINE -> {
        val mates = others.filter { it.imageId == caller.imageId }
        return if (mates.isEmpty()) Refused("no other agent is on your machine") else Many(Message.machine(caller.imageId), mates)
      }
      PHONE -> return if (others.isEmpty()) Refused("no other agent is on this phone") else Many(Message.PHONE, others)
      "" -> return Refused("say who to send it to: an agent's name, @machine or @phone")
    }
    val name = wanted.removePrefix("@").trim()
    agents.firstOrNull { it.id == name }?.let { return if (it.id == caller.id) Refused("that is you") else One(it) }
    // "Name (Kind)", as a message's from= says it: the name, when no agent has the whole.
    val named = agents.filter { it.name.equals(name, ignoreCase = true) }.ifEmpty {
      agents.filter { "${it.name} (${kindLabel(it.kind)})".equals(name, ignoreCase = true) }
    }
    return when {
      named.isEmpty() -> Refused(
        "no agent is named $name; " +
          if (others.isEmpty()) "you are the only agent on this phone" else "agents here: ${others.joinToString { it.name }}",
      )
      named.size == 1 && named[0].id == caller.id -> Refused("that is you")
      named.size == 1 -> One(named[0])
      else -> Refused(
        "${named.size} agents are named $name: " +
          named.joinToString { "${it.name} (${kindLabel(it.kind)}, ${where(it, caller)}, id ${it.id})" } +
          "; send to one by its id",
      )
    }
  }

  private fun where(agent: AgentRecord, caller: AgentRecord) = when {
    agent.id == caller.id -> "you"
    agent.imageId == caller.imageId -> "your machine"
    else -> "another machine"
  }
}
