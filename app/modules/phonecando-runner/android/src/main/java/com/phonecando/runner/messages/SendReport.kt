package com.phonecando.runner.messages

import com.phonecando.runner.messages.delivery.Handover

enum class SendStatus(val wire: String) { DELIVERED("delivered"), QUEUED("queued"), WOKEN("woken"), REFUSED("refused") }

/** What became of a send for one recipient (or the whole send, when it was refused before any). */
data class Sent(val to: String, val status: SendStatus, val reason: String? = null)

// What a sender hears about one recipient of its message: delivered (in the
// recipient's chat; when it asked to wake it, why it did not), woken (its run starts to read it: its server took the
// wake or it went in as an ACP prompt, its waiting hook or reader finds the
// wake mark within a second, its engine switches to ACP mode for it, or,
// stopped, it starts for it), or queued with when it gets it, by what the
// recipient is doing, and for an idle or stopped one why it was not woken
// or started, or how to; a kind that only pulls reads it when it next
// calls agents_inbox. A woken or started one's answer can take minutes, so
// the sender is told to end its turn rather than wait: the answer wakes it.
// Pure.
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
    /** A direct message with wake: true could wake it, or, stopped, start it (its switch and kind). */
    wakeHelps: Boolean,
    /** Its kind gets messages pushed into its turns; false: it reads them only with agents_inbox. */
    pushed: Boolean = true,
  ): Sent {
    when (handover) {
      Handover.WOKE -> return Sent(name, SendStatus.WOKEN, "it starts a turn in the background to read this. $DONT_WAIT")
      Handover.POSTED -> return if (message.wake && wakeRefusal != null) {
        Sent(name, SendStatus.DELIVERED, "in its chat; not woken: $wakeRefusal; it reads this at its next turn")
      } else {
        Sent(name, SendStatus.DELIVERED)
      }
      Handover.HELD -> if (wakeRefusal == null && folderWakes) return Sent(name, SendStatus.WOKEN, "it was idle; it wakes to read this. $DONT_WAIT")
      Handover.SWITCHING -> return Sent(name, SendStatus.WOKEN, "it was idle; it starts in the background to read this. $DONT_WAIT")
      Handover.STARTING -> return Sent(name, SendStatus.WOKEN, "it was stopped; it starts in the background to read this. $DONT_WAIT")
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
    val hint = when (presence.state) {
      AgentState.IDLE -> hintFor("woken", "wake", message, wakeRefusal, wakeHelps)
      // Nothing held it back, yet no start: Android refused the request.
      AgentState.STOPPED ->
        if (message.wake && wakeRefusal == null) " (not started: $ANDROID_REFUSED)" else hintFor("started", "start", message, wakeRefusal, wakeHelps)
      else -> ""
    }
    return Sent(name, SendStatus.QUEUED, state + hint)
  }

  private fun hintFor(done: String, verb: String, message: Message, wakeRefusal: String?, wakeHelps: Boolean): String = when {
    message.wake && wakeRefusal != null -> " (not $done: $wakeRefusal)"
    !message.wake && !message.broadcast && wakeHelps -> " (send with wake: true to $verb it)"
    else -> ""
  }

  private const val ANDROID_REFUSED = "Android did not let PhoneCanDo start it in the background"

  /**
   * After a wake or a start: agents_wait gives up after 30 s, and an answer
   * sent with replyTo wakes its asker (MessagePolicy.answerWakes).
   */
  const val DONT_WAIT = "Its answer can take minutes (a local model may take several), so don't wait for it: " +
    "end your turn, and its answer wakes you."
}
