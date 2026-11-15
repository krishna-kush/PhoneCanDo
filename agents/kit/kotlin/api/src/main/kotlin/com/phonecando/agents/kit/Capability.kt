package com.phonecando.agents.kit

// What an agent of a kind can do, as the runner checks it and the app shows
// it (`wire`). A kind declares one by its manifest (kit-render
// KindCapabilities); one it doesn't declare is off.
//   TOOLS         the phone tools (`phoneTools` plugin, mcp:config or mcp:argv)
//   MESSAGES      other agents' messages during its turns (an `inbox` block)
//   WAKE          a message can wake it while idle (`inbox.wake`)
//   TASK          it starts with a task (`engine.prompt`)
//   STATE         its own sign-in and chats (a `state` block)
//   ACP           ACP mode (`engine.acp`)
//   ACP_TOOLS     the phone tools in ACP mode
//   ACP_MESSAGES  messages during ACP turns (its inbox hooks there)
//   CHAT          the terminal opens the chat ACP mode used (`engine.acp.chat`)
// Pure.
enum class Capability(val wire: String) {
  TOOLS("tools"),
  MESSAGES("messages"),
  WAKE("wake"),
  TASK("task"),
  STATE("state"),
  ACP("acp"),
  ACP_TOOLS("acpTools"),
  ACP_MESSAGES("acpMessages"),
  CHAT("chat"),
  ;

  companion object {
    /** The capability [wire] names; null for none. */
    fun of(wire: String): Capability? = entries.firstOrNull { it.wire == wire }
  }
}
