package com.phonecando.runner.engine.acp

import com.phonecando.runner.engine.Engines

// The agents running in ACP mode, for the rest of the runner (messages,
// schedules, permissions, the app's functions): the driver of an agent
// whose engine is ready in ACP mode, and the one listener that hears what
// every driver does. Listener calls come on the driver's threads (the
// agent's reader or its steps), never the main thread, and must return
// quickly.
object AcpEngines {
  /** The live, ready ACP driver of this agent; null when it runs in terminal mode or not at all. */
  fun of(agentId: String): AcpAgentHandle? = Engines.peek()?.acpAgent(agentId)

  /** One listener (messages/ sets it once at process start). */
  @Volatile var listener: AcpListener? = null
}

/** One agent's ACP engine, ready. Thread-safe. */
interface AcpAgentHandle {
  val agentId: String

  /** The chat it works in; null before it opened one. */
  val chatId: String?

  /** Started with a chat of its own: the chat it would have gone back to (AcpChats.before); null otherwise. */
  val chatBefore: String? get() = null

  /**
   * A turn is running (a prompt sent and not answered yet), or the work it
   * was started for has not come yet ([waitingForWork]): an ACP engine is
   * busy from its start until its first work's turn ends.
   */
  val busy: Boolean

  /**
   * Busy only because the work it was started for (a waking message's
   * prompt) has not come yet: prompt() takes it. Ends at the first prompt,
   * or a minute after ready without one.
   */
  val waitingForWork: Boolean get() = false

  /**
   * Sends [text] as a prompt: in a new chat (shown as [title] on our side,
   * as ACP cannot name one) when [newChat], else the current one. False
   * when a turn runs or it is not ready (taken while [waitingForWork]).
   * [done] runs once the turn ends, on the driver's thread.
   */
  fun prompt(text: String, newChat: Boolean, title: String?, done: (AcpTurnEnd) -> Unit): Boolean

  /** Stops the turn that runs: an open permission question is answered cancelled first. */
  fun cancel()

  /** Answers the open permission question; null [optionId] = cancelled. False when no such request (or no such option). */
  fun answerPermission(requestId: String, optionId: String?): Boolean

  fun snapshot(): AcpSnapshot
}

/** How a turn ended: the agent's stop reason (end_turn, cancelled, refusal…), or [error] when it failed without one. */
data class AcpTurnEnd(val stopReason: String?, val error: String?)

/** A permission question the agent asks before a tool runs; [requestId] is ours, unique in this process. */
data class AcpPermissionAsk(
  val requestId: String,
  val title: String,
  val toolKind: String?,
  val options: List<AcpOption>,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "requestId" to requestId,
    "title" to title,
    "toolKind" to toolKind,
    "options" to options.map { it.toMap() },
  )
}

/** One answer to it; [kind] is allow_once, allow_always, reject_once or reject_always. */
data class AcpOption(val optionId: String, val name: String, val kind: String) {
  fun toMap(): Map<String, Any?> = mapOf("optionId" to optionId, "name" to name, "kind" to kind)
}

/** What a driver shows now: its chat, whether a turn runs, the last turn's items and the oldest open question. */
data class AcpSnapshot(
  val chatId: String?,
  val busy: Boolean,
  val items: List<AcpItem>,
  val permission: AcpPermissionAsk?,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "chatId" to chatId,
    "busy" to busy,
    "items" to items.map { it.toMap() },
    "permission" to permission?.toMap(),
  )
}

/** Hears every ACP driver. */
interface AcpListener {
  /** An item of the running turn was added or changed. A new turn starts with none (onBusy true). */
  fun onItem(agentId: String, item: AcpItem)

  fun onPermission(agentId: String, ask: AcpPermissionAsk)

  /** The question is answered, cancelled, or went with its turn or engine. */
  fun onPermissionGone(agentId: String, requestId: String)

  fun onTurnEnd(agentId: String, end: AcpTurnEnd)

  fun onBusy(agentId: String, busy: Boolean)
}
