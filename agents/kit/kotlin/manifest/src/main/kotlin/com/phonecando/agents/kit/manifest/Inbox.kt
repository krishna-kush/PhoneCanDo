package com.phonecando.agents.kit.manifest

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

/**
 * How other agents' messages reach a running agent of the kind (`inbox`).
 * No block: the agent only pulls them (its agents_inbox tool). The runner
 * keeps the undelivered ones in the agent's inbox folder (PHONECANDO_INBOX);
 * [hooks] are the kind's own hook events that run `phonecando-inbox <Event>`
 * and print what the runner rendered for them; [server] posts them to a
 * server engine's chat; [reader] says the kind's own extension or plugin
 * reads the folder itself. [wake] is how an idle agent of the kind can be
 * woken by one; null: it cannot (the messages wait for its next turn).
 */
data class InboxSpec(
  /** Per hook event, in manifest order. */
  val hooks: Map<String, InboxHook>,
  val server: InboxServer?,
  val reader: Boolean,
  val wake: InboxWake?,
)

/**
 * What `phonecando-inbox <Event>` prints for one hook event, and its exit
 * code. [template] is a JSON string, or (format json only) a JSON object;
 * `{{messages}}` in it is the rendered messages.
 */
data class InboxHook(val format: InboxFormat, val template: JsonElement, val exit: Int = 0) {
  companion object {
    /** The highest exit code a hook may end with. */
    const val MAX_EXIT = 255
  }
}

enum class InboxFormat(val wire: String) {
  /** Printed as it is. */
  TEXT("text"),

  /** JSON the hook runner parses: `{{messages}}` goes in as a JSON string's content. */
  JSON("json"),
}

/**
 * A server engine's inbox calls; [deliver] always, [wake] when an idle agent
 * can be woken through it, [create] when the host can make it a new chat.
 */
data class InboxServer(
  val deliver: InboxEndpoint,
  val wake: InboxEndpoint?,
  val latest: InboxLookup? = null,
  val create: InboxCreate? = null,
)

/**
 * GET [path] on the engine (no placeholders) answers its chats, newest
 * first; [id] is the JSON pointer to the newest one's id. Asked when the
 * host knows no chat of the agent's (none has run since its engine started).
 */
data class InboxLookup(val path: String, val id: String)

/**
 * [method] [path] on the engine (no placeholders) with the JSON [body],
 * whose strings may name `{{title}}` (the new chat's title), makes a new
 * chat; [id] is the JSON pointer to its id in the answer. Asked before a
 * scheduled task that wants a chat of its own wakes the agent.
 */
data class InboxCreate(val method: String, val path: String, val body: JsonObject, val id: String) {
  companion object {
    /** The one placeholder its body may name. */
    const val TITLE = "title"
  }
}

/**
 * [method] [path] on the engine (`{{sessionId}}` in it the chat, a URI
 * component) with the JSON [body], whose strings hold `{{messages}}` and
 * may hold `{{sessionId}}`.
 */
data class InboxEndpoint(val method: String, val path: String, val body: JsonObject)

/** How an idle agent of the kind can be woken: by a waiting hook, its server's wake call, or its own reader. */
enum class InboxWake(val wire: String) {
  HOOK("hook"),
  SERVER("server"),
  READER("reader"),
}
