package com.phonecando.runner.notify

// The checks' notifications as they read: a capability that stopped
// working ("<agent>: <label> isn't working", with the check's detail as its
// text; labels by the capability's wire id, kit Capability, as the app's
// checks name them), a Check now waiting for you in the agent's own app,
// and its end ("<agent>: check done" with what it found, "<agent>: check
// stopped" with why). Pure.
internal object CheckLines {
  private val LABELS = mapOf(
    "tools" to "Phone tools",
    "messages" to "Messages during its turns",
    "wake" to "Woken while idle",
    "task" to "Starts with a task",
    "state" to "Its own sign-in and chats",
    "acp" to "ACP mode",
    "acpTools" to "Phone tools in ACP mode",
    "acpMessages" to "Messages during ACP turns",
    "chat" to "Opens the ACP chat after",
  )

  /** When a failure came with no detail. */
  const val NO_DETAIL = "Open the agent's checks to see what failed."

  /** The capability's label; its id when we have none. */
  fun label(wire: String): String = LABELS[wire] ?: wire

  fun title(agentName: String, wire: String): String = "$agentName: ${label(wire)} isn't working"

  fun text(detail: String?): String = detail?.trim()?.takeIf { it.isNotEmpty() } ?: NO_DETAIL

  /** A Check now waiting for you in the agent's own app. */
  fun waitingTitle(agentName: String): String = "$agentName: check waiting for you"

  const val WAITING_TEXT = "It may be asking you something in its own app. Tap to open it."

  /** A Check now that ended: [done], or stuck or failed. */
  fun runTitle(agentName: String, done: Boolean): String = if (done) "$agentName: check done" else "$agentName: check stopped"

  /** What a done Check now found: "3 checked, 1 not working", plus ", 2 couldn't tell" when some. */
  fun runText(checked: Int, notWorking: Int, unknown: Int): String =
    "$checked checked, $notWorking not working" + if (unknown > 0) ", $unknown couldn't tell" else ""
}
