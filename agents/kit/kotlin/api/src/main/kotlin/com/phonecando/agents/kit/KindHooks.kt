package com.phonecando.agents.kit

import java.io.File

/**
 * The code a bundled kind needs where its agent.json cannot say it, by hook
 * id. The manifest names each hook it uses (`hooks`, an `sse` event's
 * `parser`, `chats.reply`'s and `engine.acp.optionsHook`); agents/builtin
 * registers one KindHooks per kind that has any.
 * A kind whose manifest names a hook its KindHooks lacks is not loaded.
 */
interface KindHooks {
  /** The kind's id (its folder and its agent.json `id`). */
  val id: String

  /** Turns one `data:` frame of the named SSE stream into an EngineEvent (null: nothing we read). */
  fun sseParser(name: String): ((String) -> EngineEvent?)? = null

  /** Reads a chat's last reply from the named `chats.reply` answer: the agent's final text (null: none in it). */
  fun replyParser(name: String): ((String) -> String?)? = null

  /**
   * Reads session config options for an ACP chat from the agent's HOME (a
   * host folder: an image kind's machine home), by config id, when the
   * runner opens a chat: what the agent's own UI last chose, which its ACP
   * mode does not read itself. Empty when there is nothing to set; never
   * throws for a missing or broken file.
   */
  fun acpOptions(name: String): ((home: File) -> Map<String, String>)? = null
}
