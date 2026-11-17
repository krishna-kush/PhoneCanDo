package com.phonecando.runner.messages.delivery

import com.phonecando.runner.agents.AgentRecord

/**
 * An agent's undelivered messages, ready to hand over: their ids (oldest
 * first), the text a model reads (Renderer), one JSON line per message for
 * an extension that reads them itself, and whether they may wake it now
 * (MessagePolicy; the mailbox decides). [newChat]: a scheduled task in it
 * asks for a chat of its own, with this title (a server that can make one
 * makes it before the wake). [scheduleIds]: the schedules whose tasks are
 * in it (a server says which chat took them).
 */
data class Parcel(
  val ids: List<Long>,
  val text: String,
  val jsonl: String,
  val wake: Boolean,
  val newChat: String? = null,
  val scheduleIds: List<String> = emptyList(),
)

/** How a parcel went. */
enum class Handover {
  /** Posted into its chat by its server (delivered). */
  POSTED,

  /** Its server's wake call took it, or it went in as an ACP prompt: a run started (delivered, woke). */
  WOKE,

  /** Left in its inbox folder for its hooks or its own reader (still queued until the receipt). */
  HELD,

  /**
   * It may wake an idle agent whose kind has an ACP mode, now in terminal
   * mode with nobody watching: we asked its engine to switch to ACP mode,
   * and the set goes in as a prompt once that is ready (still queued).
   */
  SWITCHING,

  /**
   * It may start a stopped agent (start/StartRules): we asked for its
   * engine (in ACP mode for a kind with one), and the set goes in as a
   * prompt, or through its server's wake call, once that is ready (still
   * queued).
   */
  STARTING,

  /** Nothing can take it now: a kind that only pulls (agents_inbox), or a server with no chat yet. */
  NONE,
}

// Hands an agent its messages the way its kind takes them (the manifest's
// `inbox`; InboxCourier), or as a prompt in ACP mode (AcpCourier), as
// RoutingCourier picks. The mailbox calls it for one agent at a time
// (never twice at once for the same agent), outside its own lock.
interface Courier {
  /**
   * The ids of the parcel last left in [agent]'s folder when its hook or
   * reader has claimed it since (its receipt may not be read yet); empty
   * otherwise. Forgets that parcel.
   */
  fun claimed(agent: AgentRecord): Set<Long>

  /** [retry]: not a new message (an engine start, a chat that showed up), so a recent failure may wait. */
  fun handOver(agent: AgentRecord, parcel: Parcel, retry: Boolean = false): Handover

  /** Nothing is undelivered: no pending messages in its folder. */
  fun clear(agent: AgentRecord)

  /** Its engine starts: its inbox folder made, what an earlier life left half done removed. */
  fun prepare(agent: AgentRecord) {}

  /** The agent is deleted: forget it. */
  fun forget(agentId: String) {}
}
