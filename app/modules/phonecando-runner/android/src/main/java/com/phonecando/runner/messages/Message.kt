package com.phonecando.runner.messages

// One message between agents (or a runner notice to one), as the log keeps
// it: who sent it and to whom, by id and by the names they had then (the
// log keeps names after an agent is deleted), what it says (sanitised,
// MessageText), what it answers, how many agent-started turns led to it
// (hop: 0 from a turn the user started, the cause's hop + 1 from a turn
// another agent's message started), whether the sender asked to wake an
// idle recipient (direct messages only) and, per recipient, how far it got
// (Delivery). A notice may be a scheduled task (ScheduledNote). Pure.
data class Message(
  /** The runner's sequence, increasing. */
  val id: Long,
  /** The sender's agent id; [RUNNER] for a runner notice. */
  val from: String,
  val fromName: String,
  /** The sender's kind id; null for a notice. */
  val fromKind: String?,
  /** The sender's machine (image id) when it sent it; null for a notice. */
  val fromImage: String?,
  /** An agent id, [machine] of an image, or [PHONE]. */
  val to: String,
  /** The recipient's name when sent directly; null for a broadcast. */
  val toName: String?,
  val text: String,
  val replyTo: Long?,
  /** Epoch ms. */
  val sentAt: Long,
  val hop: Int,
  /** The sender asked to wake the recipient (direct messages only). */
  val wake: Boolean,
  /** A runner notice (the screen queue), not an agent's message. */
  val notice: Boolean,
  val deliveries: List<Delivery>,
  /** A scheduled task's notice (schedule/); null for every other message. */
  val scheduled: ScheduledNote? = null,
) {
  /** The text as its recipient reads it: a scheduled task's with its label (ScheduledNote.line). */
  val readText: String get() = scheduled?.line(text) ?: text

  val broadcast: Boolean get() = to == PHONE || to.startsWith(MACHINE_PREFIX)

  fun deliveryTo(agentId: String): Delivery? = deliveries.firstOrNull { it.agentId == agentId }

  fun withDelivery(agentId: String, change: (Delivery) -> Delivery): Message =
    copy(deliveries = deliveries.map { if (it.agentId == agentId) change(it) else it })

  companion object {
    /** The sender of runner notices. */
    const val RUNNER = "runner"

    /** How a notice's sender reads, to the model and in the app. */
    const val RUNNER_NAME = "PhoneCanDo"

    const val PHONE = "@phone"
    private const val MACHINE_PREFIX = "@machine:"

    fun machine(imageId: String) = "$MACHINE_PREFIX$imageId"

    /** The image id of a machine broadcast's target; null for any other. */
    fun machineOf(to: String): String? = to.takeIf { it.startsWith(MACHINE_PREFIX) }?.removePrefix(MACHINE_PREFIX)
  }
}

/** How far a message got with one recipient; [woke]: handing it over started the recipient's turn. */
data class Delivery(
  val agentId: String,
  /** The recipient's name when it was sent. */
  val name: String,
  val status: DeliveryStatus,
  val woke: Boolean = false,
  /** Why it was refused, or dropped unread. */
  val reason: String? = null,
  /** Epoch ms of the last change. */
  val at: Long = 0L,
) {
  /** Not yet in the recipient's turn: what its unread count and agents_inbox are. */
  val unread: Boolean get() = status == DeliveryStatus.QUEUED
}

/**
 * QUEUED until it is in the recipient's turn: DELIVERED (posted to its
 * server, or claimed by its hook without a receipt yet), READ (its hook,
 * extension or agents_inbox confirmed it). REFUSED: never handed over
 * (a rate limit, or dropped unread past the cap).
 */
enum class DeliveryStatus(val wire: String) {
  QUEUED("queued"),
  DELIVERED("delivered"),
  READ("read"),
  REFUSED("refused"),
  ;

  companion object {
    fun of(wire: String?): DeliveryStatus = entries.firstOrNull { it.wire == wire } ?: QUEUED
  }
}
