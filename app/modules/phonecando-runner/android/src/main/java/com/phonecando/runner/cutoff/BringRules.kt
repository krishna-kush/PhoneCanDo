package com.phonecando.runner.cutoff

import com.phonecando.runner.engine.EngineMode

// How a run cut off goes on, in the same chat, row by row. Pure.
//   ran in ACP mode, kind has one, its chat known      START_ACP (reopens that chat, the note its first prompt)
//   ran in its own app, a server kind that wakes
//     through its server, a chat known                 START_THEN_POST (the note into that chat once ready)
//   ran in its own app, a TUI that starts with a
//     prompt and has resume args                       START_WITH_PROMPT (resumes its last chat with the note)
//   anything else                                      OPEN (you open it and go on)
// An agent brought back MAX_BROUGHT times within WINDOW_MS gets OPEN: a run
// that keeps getting cut off (out of memory, a crash) never loops.
// Continue waits (says why, and stays) while a Check now runs on the agent,
// its machine installs an agent, or another engine starts (one at a time).
object BringRules {
  const val WINDOW_MS = 6 * 60 * 60_000L
  const val MAX_BROUGHT = 2

  /** A bring-back still starting holds the next one back at most this long (one at a time). */
  const val STARTING_MAX_MS = 3 * 60_000L

  enum class Plan { START_ACP, START_THEN_POST, START_WITH_PROMPT, OPEN }

  /** What the agent's kind can do (its manifest). */
  data class Kind(
    val server: Boolean,
    val acp: Boolean,
    /** `engine.prompt`: its TUI starts with a first prompt. */
    val prompts: Boolean,
    /** `engine.resume`: a relaunch opens its last chat. */
    val resumes: Boolean,
    /** `inbox.wake` server with a wake call. */
    val wakesByServer: Boolean,
  )

  /** How runs that ran in [mode] in [chats] go on for [kind] (null: the kind is gone). */
  fun plan(mode: EngineMode, kind: Kind?, chats: List<String?>): Plan {
    val known = chats.any { it != null }
    return when {
      kind == null -> Plan.OPEN
      mode == EngineMode.ACP -> if (kind.acp && known) Plan.START_ACP else Plan.OPEN
      kind.server -> if (kind.wakesByServer && known) Plan.START_THEN_POST else Plan.OPEN
      kind.prompts && kind.resumes -> Plan.START_WITH_PROMPT
      else -> Plan.OPEN
    }
  }

  /** Why Continue cannot start it now (its notice says so and keeps Continue); null when it can. */
  fun waitFor(checking: Boolean, installing: Boolean, starting: Boolean): String? = when {
    checking -> CutOffText.CHECKING
    installing -> CutOffText.INSTALLING
    starting -> CutOffText.WAIT
    else -> null
  }

  /** How often [agentId] was brought back within WINDOW_MS before [now]. */
  fun count(brought: Map<String, List<Long>>, agentId: String, now: Long): Int =
    brought[agentId].orEmpty().count { now - it in 0 until WINDOW_MS }

  /** It was brought back too often to try again by itself. */
  fun spent(brought: Map<String, List<Long>>, agentId: String, now: Long): Boolean = count(brought, agentId, now) >= MAX_BROUGHT

  /** [agentId] brought back at [now]; times past the window go. */
  fun add(brought: Map<String, List<Long>>, agentId: String, now: Long): Map<String, List<Long>> {
    val kept = prune(brought, now)
    return kept + (agentId to (kept[agentId].orEmpty() + now))
  }

  /** Only the times within the window. */
  fun prune(brought: Map<String, List<Long>>, now: Long): Map<String, List<Long>> =
    brought.mapValues { (_, times) -> times.filter { now - it in 0 until WINDOW_MS } }.filterValues { it.isNotEmpty() }
}
