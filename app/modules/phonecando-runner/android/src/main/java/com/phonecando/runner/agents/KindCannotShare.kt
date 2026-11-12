package com.phonecando.runner.agents

/**
 * A second agent of [kind] on one machine, refused: the kind cannot keep
 * an agent's sign-in, settings and chats in a folder of its own (kit
 * AgentKind.ownStateSupported), so the two would share them. [CODE], also
 * the start of the message, is what JS matches.
 */
class KindCannotShare(val kind: String) : Exception("$CODE: two $kind agents can't share a machine") {
  companion object {
    const val CODE = "kind_cannot_share"
  }
}
