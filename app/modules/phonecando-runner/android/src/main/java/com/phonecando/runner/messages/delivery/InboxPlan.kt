package com.phonecando.runner.messages.delivery

import com.phonecando.agents.kit.InboxCall
import com.phonecando.agents.kit.InboxRequest

/** How messages reach a running agent of one kind: its manifest's `inbox` (KindInbox), or a test's. */
interface InboxPlan {
  /** Its hook events, each with its exit code (0 when it names none). */
  val hooks: Map<String, Int>

  /** Its own extension or plugin reads the inbox folder. */
  val reader: Boolean

  /** Its server takes them (deliver, and wake when [wakesByServer]). */
  val server: Boolean

  /** An idle agent of it is woken through its server's wake call. */
  val wakesByServer: Boolean

  /** The inbox folder matters: hooks print it, or a reader reads it. */
  val folder: Boolean get() = hooks.isNotEmpty() || reader

  /** What `phonecando-inbox <[event]>` prints for [text]. */
  fun hookOutput(event: String, text: String): String

  /** The server call; null when it has none of that kind or it needs a chat and [sessionId] is blank. */
  fun request(call: InboxCall, port: String, password: String, sessionId: String, text: String): InboxRequest?

  /** The request for the agent's newest chat, for when no chat of its is known; null when the kind has none. */
  fun latestRequest(port: String, password: String): InboxRequest? = null

  /** The newest chat's id in what that request answered; null when it names none. */
  fun latestId(answer: String): String? = null
}
