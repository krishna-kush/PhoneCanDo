package com.phonecando.runner.messages

import com.phonecando.runner.messages.delivery.Handover

enum class SendStatus(val wire: String) { DELIVERED("delivered"), QUEUED("queued"), WOKEN("woken"), REFUSED("refused") }

/** What became of a send for one recipient (or the whole send, when it was refused before any). */
data class Sent(val to: String, val status: SendStatus, val reason: String? = null)

// What a sender hears about one recipient of its message: delivered (in the
// recipient's chat), woken (its run starts to read it: its server took the
// wake, or its waiting hook or reader finds the wake mark within a second),
// or queued with when it gets it, by what the recipient is doing, and for an
// idle one why it was not woken or how to wake it; a kind that only pulls
// reads it when it next calls agents_inbox. Pure.
object SendReport {
  fun of(
    name: String,
    message: Message,
    handover: Handover,
    presence: Presence,
    /** Why this message may not wake the recipient now; null when it may. */
    wakeRefusal: String?,
    /** The set left in its folder carries the wake mark. */
    folderWakes: Boolean,
    /** A direct message with wake: true could wake it (its switch and kind). */
    wakeHelps: Boolean,
    /** Its kind gets messages pushed into its turns; false: it reads them only with agents_inbox. */
    pushed: Boolean = true,
  ): Sent {
    when (handover) {
      Handover.WOKE -> return Sent(name, SendStatus.WOKEN)
      Handover.POSTED -> return Sent(name, SendStatus.DELIVERED)
      Handover.HELD -> if (wakeRefusal == null && folderWakes) return Sent(name, SendStatus.WOKEN, "it was idle; it wakes to read this")
      Handover.NONE -> {}
    }
    if (!pushed) return Sent(name, SendStatus.QUEUED, "nothing is pushed to it; it reads this when it next calls agents_inbox")
    val state = when (presence.state) {
      AgentState.STOPPED -> "it is stopped; it gets this when it next runs"
      AgentState.STARTING -> "it is starting; it gets this once it runs"
      AgentState.WORKING -> "it is working; it gets this during its run"
      AgentState.WAITING -> "it is waiting for the user's answer; it gets this at its next turn"
      AgentState.IDLE -> "it is idle; it gets this at its next turn"
    }
    val hint = when {
      presence.state != AgentState.IDLE -> ""
      message.wake && wakeRefusal != null -> " (not woken: $wakeRefusal)"
      !message.wake && !message.broadcast && wakeHelps -> " (send with wake: true to wake it)"
      else -> ""
    }
    return Sent(name, SendStatus.QUEUED, state + hint)
  }
}
