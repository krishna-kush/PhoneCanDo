package com.phonecando.runner.engine.acp

// Which chat an agent's ACP mode keeps (AgentRecord.acpChat) as its turns
// end. A chat it reopened is the agent's already. A new one is kept at
// once, so a run cut off mid-turn goes on in it, but for good only once a
// turn in it was answered (a stop reason other than cancelled, no error):
// an agent may keep no chat it never answered in (Gemini CLI takes back a
// turn that failed and deletes a chat left empty), and a terminal launch
// or the next ACP start would fail on it. So the first turn of a new chat
// that ends unanswered gives back the chat kept before it, or none. Pure.
internal object AcpKeptChat {
  /** A new chat no turn has answered in yet, and the chat kept before it. */
  data class Untried(val chatId: String, val before: String?)

  /** What to do with the kept chat once a turn ended. */
  sealed interface Act {
    data object Nothing : Act

    data class Keep(val chatId: String) : Act

    data object Forget : Act
  }

  /** The turn's end says the agent answered it. */
  fun answered(stopReason: String?, error: String?): Boolean = error == null && stopReason != null && stopReason != CANCELLED

  /** A turn in [chat] ended, [answered] or not, while [untried] was the new chat waiting for its first answer. */
  fun afterTurn(untried: Untried?, chat: String?, answered: Boolean): Act = when {
    untried == null || answered || untried.chatId != chat -> Act.Nothing
    untried.before != null -> Act.Keep(untried.before)
    else -> Act.Forget
  }

  private const val CANCELLED = "cancelled"
}
