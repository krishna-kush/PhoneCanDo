package com.phonecando.runner.messages

import com.phonecando.agents.kit.MessagingLevel
import com.phonecando.runner.agents.AgentRecord

// What messaging reads about the agents and the screen, whatever keeps
// them: the store's records, each agent's state from its engine and chats,
// its kind's label, level and whether it can be woken (now), and who has
// the screen.
// LiveAgentsView reads the running app; tests fake it.
interface AgentsView {
  /** Every agent, in store order. */
  fun all(): List<AgentRecord>

  fun get(id: String): AgentRecord? = all().firstOrNull { it.id == id }

  /** The kind's label ("Claude Code"); its id when this build has no such kind. */
  fun kindLabel(kind: String): String

  /** Whether an idle agent of [kind] can be woken (its manifest's `inbox.wake`). */
  fun kindCanWake(kind: String): Boolean

  /** How far messages reach an agent of [kind] (kit MessagingLevel); NONE for a kind this build lacks. */
  fun kindLevel(kind: String): MessagingLevel

  /**
   * Whether [agent] can be woken now as far as its kind goes: a kind that
   * wakes only through a hook it leaves waiting after a turn (`inbox.wake`
   * "hook", for as long as its manifest lets that hook wait) has that hook
   * alive. True for every other kind.
   */
  fun wakeReady(agent: AgentRecord): Boolean = true

  fun presence(agentId: String): Presence

  /** Who holds the screen and who waits for it; empty when no bridge is open or in builds without a driver. */
  fun screen(): ScreenLine = ScreenLine.NONE
}

/** What an agent is doing now, and its chat's title (the working one, else the latest); null when none is known. */
data class Presence(val state: AgentState, val chat: String? = null) {
  /** Its engine is ready. */
  val running: Boolean get() = state != AgentState.STOPPED && state != AgentState.STARTING

  /** Ready, with no run going and no question waiting: a wake may start a run. */
  val idle: Boolean get() = state == AgentState.IDLE

  companion object {
    val STOPPED = Presence(AgentState.STOPPED)
  }
}

/** As agents_list says it; STARTING reads as idle there (the engine is on its way). */
enum class AgentState(val wire: String) {
  WORKING("working"),
  WAITING("waiting"),
  IDLE("idle"),
  STARTING("idle"),
  STOPPED("stopped"),
}

/** The screen's holder (or the agent it is reserved for) and the agents in line, by id. */
data class ScreenLine(val holder: String?, val reserved: Boolean, val waiting: List<String>) {
  companion object {
    val NONE = ScreenLine(null, false, emptyList())
  }
}
