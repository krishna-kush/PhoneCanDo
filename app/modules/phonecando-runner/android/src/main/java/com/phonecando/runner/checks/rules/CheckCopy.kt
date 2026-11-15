package com.phonecando.runner.checks.rules

import com.phonecando.agents.kit.InboxCall

// The failure codes the rules record and the detail each shows (the
// notification's text, the agent page's line). Pure.
internal object CheckCopy {
  const val NO_CONTACT = "no_contact"
  const val NO_HOOK = "no_hook"
  const val NO_WAITER = "no_waiter"
  const val NO_RECEIPT = "no_receipt"
  const val QUIT_OK = "quit_ok"
  const val QUIT_ERROR = "quit_error"
  const val EMPTY_STATE = "empty_state"
  const val ACP_FAILED = "acp_failed"
  const val CHAT_REFUSED = "chat_refused"

  /** The longest reason or screen excerpt a detail quotes. */
  const val QUOTE_MAX = 200

  fun http(status: Int) = "http_$status"

  fun noContact(acp: Boolean) =
    "It finished a turn${inAcp(acp)} without ever reaching PhoneCanDo's tools. " +
      "If it asked to trust this folder or allow a tools server, allow it; otherwise its tools setting is wrong."

  fun noHook(events: List<String>, acp: Boolean) =
    "It finished a turn${inAcp(acp)} and none of its message hooks (${events.joinToString(", ")}) ran, " +
      "so messages wait until it checks its inbox. If it asked to trust this folder, allow it."

  const val NO_WAITER_DETAIL = "It finished a turn and its waiting hook didn't start, so a message can't wake it."

  const val NO_RECEIPT_DETAIL = "A message that should wake it got no answer in a minute."

  fun httpDetail(call: InboxCall, status: Int) = when (call) {
    InboxCall.DELIVER -> "Its server answered $status when we handed it messages."
    InboxCall.WAKE -> "Its server answered $status when we asked it to take a message that wakes it."
  }

  const val QUIT_OK_DETAIL = "It ran the task and quit (exit 0): that start runs one task and exits, so it can't stay open."

  fun quitError(code: Int, lines: String?) =
    "It quit with exit $code right after starting with the task." + (lines?.let { " Its last lines: $it" } ?: "")

  const val EMPTY_STATE_DETAIL = "After a whole turn it kept nothing in its own folder, so it shares the first agent's sign-in and chats."

  fun acpFailed(reason: String) = reason.trim().take(QUOTE_MAX).ifEmpty { "Its ACP mode failed to start." }

  fun chatRefused(code: Int) =
    "It quit with exit $code when started on the chat ACP mode used, so it opened a new chat instead."

  private fun inAcp(acp: Boolean) = if (acp) " in ACP mode" else ""
}
