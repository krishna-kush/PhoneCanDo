package com.phonecando.runner.messages

import com.phonecando.agents.kit.MessagingLevel
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.messages.delivery.Courier
import com.phonecando.runner.messages.delivery.Handover
import com.phonecando.runner.messages.delivery.Parcel
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

// The agents' messages: send, inbox, wait, receipts and runner notices, over
// the log (MessageLog) and the agents as AgentsView sees them.
// - send: the text cleaned (MessageText; empty or over 4000 characters is
//   refused), `to` resolved (Addressing), the duplicate check and the rate
//   limits (MessagePolicy), then one message with a delivery per
//   recipient, its hop from the sender's run (WakeTracker), handed to each
//   recipient at once; what each recipient's delivery came to is the reply
//   (SendReport). Past 50 unread an agent's oldest are dropped, with a
//   notice.
// - deliver: an agent's oldest unread, as many as fit one hand-over
//   (Parcels), to the Courier, one agent at a time (a gate per agent):
//   posted (delivered), woken (delivered, woke) or held in its inbox folder
//   (still unread). The parcel may wake the agent when one of its unread
//   messages passes MessagePolicy.wakeRefusal. Again on
//   every engine start, chat-board change (a server's chat showed up; an
//   agent went idle, so a wake may apply now), read and receipt.
// - receipt (`@inbox <ids>` in its events file), agents_inbox and
//   agents_wait mark read; a held set with the wake mark, claimed while the
//   agent had no run going, woke it (its wake budget; its run is
//   startedByAgent).
// onChange runs after every change (the app's phonecandoMessages event).
// Pure apart from the log's store and the courier; the clock is injected.
class Mailbox(
  private val log: MessageLog,
  private val agents: AgentsView,
  private val courier: Courier,
  private val clock: () -> Long = System::currentTimeMillis,
  private val onChange: () -> Unit = {},
  private val onError: (String, Throwable) -> Unit = { _, _ -> },
) {
  data class SendResult(val id: Long?, val results: List<Sent>)

  /** Messages taken from an inbox (now read), and whether more are unread. */
  data class Taken(val messages: List<Message>, val more: Boolean)

  sealed interface Waited {
    data class Got(val taken: Taken) : Waited

    data object TimedOut : Waited

    data class Refused(val reason: String) : Waited
  }

  val policy = MessagePolicy(clock)
  val wakes = WakeTracker(clock)

  private val gates = ConcurrentHashMap<String, Any>()

  // The set last left in each agent's inbox folder: a receipt for it may be a wake.
  private val parcels = ConcurrentHashMap<String, Parcel>()

  init {
    // The wake budget outlives the process.
    log.wokeAt().forEach { (agentId, at) -> policy.woke(agentId, at) }
  }

  // ---- send ------------------------------------------------------------------

  fun send(caller: AgentRecord, to: String, rawText: String, replyTo: Long?, wake: Boolean): SendResult {
    val text = MessageText.clean(rawText)
    if (text.isEmpty()) return refused(to, "the message is empty")
    if (text.length > MessageRules.MAX_CHARS) {
      return refused(to, "the message is ${text.length} characters, over ${MessageRules.MAX_CHARS}; shorten it or send it in parts")
    }
    val (addressedTo, target) = when (val addressed = Addressing.resolve(to, caller, agents.all(), agents::kindLabel)) {
      is Addressing.Refused -> return refused(to, addressed.reason)
      is Addressing.One -> listOf(addressed.agent) to addressed.agent.id
      is Addressing.Many -> addressed.agents to addressed.target
    }
    // An agent whose kind has no phone tools can never read it: refused (and
    // logged so, for the user to see), not queued for good.
    val (recipients, unreadable) = addressedTo.partition { agents.kindLevel(it.kind).reads }
    val cannot = unreadable.map { Sent(it.name, SendStatus.REFUSED, cannotRead(it)) }
    val broadcast = target != addressedTo[0].id
    val label = if (broadcast) to.trim() else addressedTo[0].name
    if (policy.duplicate(caller.id, target, text)) return refused(label, "you sent the same message under a minute ago")
    val limit = if (broadcast) policy.broadcastRefusal(caller.id) else policy.directRefusal(caller.id, target)
    if (limit != null) return refused(label, limit)
    if (broadcast) policy.sentBroadcast(caller.id, target, text) else policy.sentDirect(caller.id, target, text)
    val hop = wakes.hopFor(caller.id)
    val message = log.add { id ->
      val now = clock()
      Message(
        id = id,
        from = caller.id,
        fromName = caller.name,
        fromKind = caller.kind,
        fromImage = caller.imageId,
        to = target,
        toName = if (broadcast) null else addressedTo[0].name,
        text = text,
        replyTo = replyTo?.takeIf { it in 1 until id },
        sentAt = now,
        hop = hop,
        wake = wake && !broadcast,
        notice = false,
        deliveries = recipients.map { Delivery(it.id, it.name, DeliveryStatus.QUEUED, at = now) } +
          unreadable.map { Delivery(it.id, it.name, DeliveryStatus.REFUSED, reason = cannotRead(it), at = now) },
      )
    }
    recipients.forEach { capUnread(it) }
    val results = recipients.map { r ->
      val out = deliver(r.id)
      SendReport.of(
        name = r.name,
        message = message,
        handover = out.handover,
        presence = out.presence,
        wakeRefusal = MessagePolicy.wakeRefusal(wakeCheck(message, r, out.presence), clock()),
        folderWakes = out.parcel?.wake == true,
        wakeHelps = r.wakeable && agents.kindCanWake(r.kind) && agents.wakeReady(r),
        pushed = agents.kindLevel(r.kind) != MessagingLevel.INBOX,
      )
    }
    changed()
    return SendResult(message.id, results + cannot)
  }

  private fun cannotRead(agent: AgentRecord) =
    "${agent.name} can't read messages: ${agents.kindLabel(agent.kind)} isn't connected to the phone tools"

  /** A runner notice to [agentId] (the screen queue); [wake]: it may wake the agent as a direct message that asks to. */
  fun notice(agentId: String, text: String, wake: Boolean = false) {
    val agent = agents.get(agentId) ?: return
    log.add { id -> noticeTo(id, agent, MessageText.clean(text), wake) }
    capUnread(agent)
    deliver(agentId)
    changed()
  }

  private fun refused(to: String, reason: String) = SendResult(null, listOf(Sent(to, SendStatus.REFUSED, reason)))

  private fun noticeTo(id: Long, agent: AgentRecord, text: String, wake: Boolean): Message {
    val now = clock()
    return Message(
      id = id, from = Message.RUNNER, fromName = Message.RUNNER_NAME, fromKind = null, fromImage = null,
      to = agent.id, toName = agent.name, text = text, replyTo = null, sentAt = now, hop = 0, wake = wake,
      notice = true, deliveries = listOf(Delivery(agent.id, agent.name, DeliveryStatus.QUEUED, at = now)),
    )
  }

  // Past UNREAD_MAX the oldest unread go (refused, with why), and one notice says so.
  private fun capUnread(agent: AgentRecord) {
    if (log.unread(agent.id).size <= MessageRules.UNREAD_MAX) return
    val dropped = log.dropOldest(agent.id, MessageRules.UNREAD_MAX - 1, DROPPED)
    val text = "$dropped older messages to you were dropped unread: more than ${MessageRules.UNREAD_MAX} were waiting. " +
      "Call agents_inbox to read the rest."
    log.add { id -> noticeTo(id, agent, text, wake = false) }
  }

  // ---- read --------------------------------------------------------------------

  /** Up to [limit] of [caller]'s unread messages, oldest first, now read. */
  fun inbox(caller: AgentRecord, limit: Int): Taken {
    val (some, more) = log.take(caller.id, limit.coerceIn(1, MessageRules.INBOX_MAX))
    val taken = Taken(some, more)
    afterRead(caller.id, taken)
    return taken
  }

  /**
   * The first unread message for [caller] (from the agent [from] names,
   * when given), now read; one already waiting returns at once, else this
   * blocks up to [timeoutMs] (on the bridge's thread for this request).
   */
  fun wait(caller: AgentRecord, from: String?, timeoutMs: Long): Waited {
    val fromId = from?.trim()?.takeIf { it.isNotEmpty() }?.let { name ->
      when (val who = Addressing.resolve(name, caller, agents.all(), agents::kindLabel)) {
        is Addressing.One -> who.agent.id
        is Addressing.Many -> return Waited.Refused("wait for one agent by name, or for anyone")
        is Addressing.Refused -> return Waited.Refused(who.reason)
      }
    }
    val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMs.coerceAtLeast(0))
    val (first, more) = log.awaitFirst(caller.id, deadline) { fromId == null || it.from == fromId } ?: return Waited.TimedOut
    val taken = Taken(listOf(first), more)
    afterRead(caller.id, taken)
    return Waited.Got(taken)
  }

  // What is left unread goes back into its folder (or the folder empties).
  private fun afterRead(agentId: String, taken: Taken) {
    if (taken.messages.isEmpty()) return
    deliver(agentId)
    changed()
  }

  /**
   * [agentId]'s hook or reader put these in its turn (`@inbox <ids>` in its
   * events file): read. A held set with the wake mark, claimed while the
   * agent had no run going, woke it. [presence] is the agent's when the
   * receipt was written: by the time this runs, the run the claim started
   * may already show (a waiting hook raises it right after its receipt).
   */
  fun receipt(agentId: String, ids: List<Long>, presence: Presence = agents.presence(agentId)) {
    val mine = log.readable(agentId, ids)
    if (mine.isEmpty()) return
    val parcel = parcels[agentId]
    val woke = parcel != null && parcel.wake && mine.any { it in parcel.ids } && presence.state != AgentState.WORKING
    log.mark(agentId, mine, DeliveryStatus.READ, woke = woke)
    if (woke) {
      policy.woke(agentId)
      wakes.woke(agentId, mine.mapNotNull { log.get(it)?.hop }.maxOrNull() ?: 0, workingNow = false)
    }
    deliver(agentId)
    changed()
  }

  // ---- delivery ------------------------------------------------------------------

  private class Outcome(val handover: Handover, val presence: Presence, val parcel: Parcel?)

  /** Hands [agentId] its unread set again (its wake switch changed, say); a set already in its folder unchanged stays. */
  fun refresh(agentId: String) {
    deliver(agentId, retry = true)
  }

  private fun deliver(agentId: String, retry: Boolean = false): Outcome {
    val agent = agents.get(agentId) ?: return Outcome(Handover.NONE, Presence.STOPPED, null)
    synchronized(gates.getOrPut(agentId) { Any() }) {
      val claimed = guarded(emptySet()) { courier.claimed(agent) }
      if (claimed.isNotEmpty()) log.mark(agentId, claimed, DeliveryStatus.DELIVERED)
      val presence = agents.presence(agentId)
      val unread = log.unread(agentId)
      if (unread.isEmpty()) {
        parcels.remove(agentId)
        guarded(Unit) { courier.clear(agent) }
        return Outcome(Handover.NONE, presence, null)
      }
      val wakers = unread.filter { MessagePolicy.wakeRefusal(wakeCheck(it, agent, presence), clock()) == null }
      val parcel = Parcels.build(unread, agent.imageId, agents::kindLabel) { it in wakers }
      val last = parcels[agentId]
      if (retry && last != null && last.ids == parcel.ids && last.wake == parcel.wake) {
        return Outcome(Handover.HELD, presence, parcel)
      }
      val handover = guarded(Handover.NONE) { courier.handOver(agent, parcel, retry) }
      when (handover) {
        Handover.POSTED, Handover.WOKE -> {
          val woke = handover == Handover.WOKE
          log.mark(agentId, parcel.ids, DeliveryStatus.DELIVERED, woke = woke)
          parcels.remove(agentId)
          if (woke) {
            policy.woke(agentId)
            wakes.woke(agentId, wakers.maxOf { it.hop }, workingNow = false)
          }
        }
        Handover.HELD -> parcels[agentId] = parcel
        Handover.NONE -> parcels.remove(agentId)
      }
      return Outcome(handover, presence, parcel)
    }
  }

  private fun wakeCheck(m: Message, agent: AgentRecord, presence: Presence) = MessagePolicy.WakeCheck(
    asked = m.wake,
    broadcast = m.broadcast,
    hop = m.hop,
    sentAt = m.sentAt,
    wakeable = agent.wakeable,
    kindCanWake = agents.kindCanWake(agent.kind),
    hookWaiting = agents.wakeReady(agent),
    running = presence.running,
    idle = presence.idle,
    wakesLeft = policy.wakesLeft(agent.id),
  )

  // ---- engine and chat changes ----------------------------------------------------

  /** [agentId]'s engine starts: its folder ready (what an earlier life left removed), its unread set in it. */
  fun engineStarting(agentId: String) {
    val agent = agents.get(agentId) ?: return
    guarded(Unit) { courier.prepare(agent) }
    parcels.remove(agentId)
    deliver(agentId, retry = true)
  }

  /** [agentId]'s engine is ready: a server takes its unread set now. */
  fun engineReady(agentId: String) {
    deliver(agentId, retry = true)
  }

  /** [agentId]'s engine stopped or died: a run a message started is over. */
  fun engineGone(agentId: String) {
    wakes.ended(agentId)
  }

  /**
   * The chat board changed; [working] are the agents with a run going. Ends
   * the woken runs that are over and hands unread sets again (a server's
   * chat may have shown up; an agent that went idle may be woken now).
   */
  fun chatsChanged(working: Set<String>) {
    wakes.working(working)
    for (agentId in log.unreadCounts().keys) deliver(agentId, retry = true)
  }

  /** A deleted agent: the messages to it go (the log keeps what it sent, under its name). */
  fun forget(agentId: String) {
    log.forget(agentId)
    parcels.remove(agentId)
    gates.remove(agentId)
    wakes.ended(agentId)
    guarded(Unit) { courier.forget(agentId) }
    changed()
  }

  // ---- reads ---------------------------------------------------------------------

  fun unread(agentId: String): Int = log.unread(agentId).size

  fun unreadCounts(): Map<String, Int> = log.unreadCounts()

  /** The newest [limit] messages, newest first. */
  fun recent(limit: Int): List<Message> = log.newest(limit.coerceIn(0, MessageRules.LOG_PAGE_MAX))

  private fun changed() {
    try {
      onChange()
    } catch (e: Exception) {
      onError("message listener failed", e)
    }
  }

  private inline fun <T> guarded(fallback: T, block: () -> T): T = try {
    block()
  } catch (e: Exception) {
    onError("inbox not updated", e)
    fallback
  }

  companion object {
    const val DROPPED = "dropped unread: too many were waiting"
  }
}
