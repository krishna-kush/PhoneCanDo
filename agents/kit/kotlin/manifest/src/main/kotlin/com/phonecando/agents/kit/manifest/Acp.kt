package com.phonecando.agents.kit.manifest

import kotlinx.serialization.json.JsonObject

/**
 * A tui kind's ACP mode (`engine.acp`): the command that starts the same
 * agent speaking the Agent Client Protocol on stdin and stdout, with no
 * screen. It runs in `engine.launch.cwd`, with [env] on top of the launch
 * env and the agent's state env. Templates stay unrendered here.
 */
data class AcpSpec(
  /** Like `engine.launch.argv`; never `{{prompt}}` or `{{chatId}}`. */
  val argv: List<ArgvItem>,
  /** In manifest order. */
  val env: Map<String, String>,
  /** How the agent gets the phone tools in ACP mode. */
  val tools: AcpTools = AcpTools.SESSION,
  /** Session config options set on every chat it opens, by config id, in manifest order. */
  val options: Map<String, String> = emptyMap(),
  /** Passed as `_meta` when a chat opens; its strings are templates as env values are. */
  val meta: JsonObject? = null,
  /** Terminal-mode args that open one given chat. */
  val chat: ChatArgs? = null,
) {
  companion object {
    /** The most session config options a kind sets. */
    const val MAX_OPTIONS = 8

    /** The longest config id or value, in characters. */
    const val MAX_OPTION_LENGTH = 64

    /** The most UTF-8 bytes `meta` holds, as compact JSON. */
    const val MAX_META_BYTES = 4 * 1024
  }
}

/** How an agent in ACP mode gets the phone tools. */
enum class AcpTools(val wire: String) {
  /** The bridge goes in session/new as an HTTP MCP server, and not in the env. */
  SESSION("session"),

  /** The kind's own config names the bridge, as in terminal mode: the env keeps it. */
  CONFIG("config"),
}

/**
 * Terminal-mode args (templates) that open one given chat: exactly one is
 * `{{chatId}}`, whole, so the chat id is one argv item. At argv index
 * [at], or appended, in place of the resume args.
 */
data class ChatArgs(val args: List<String>, val at: Int?) {
  companion object {
    /** The one placeholder only these args may name: the chat to open. */
    const val PLACEHOLDER = "chatId"
  }
}
