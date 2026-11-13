package com.phonecando.runner.messages

import com.phonecando.runner.messages.MessageRules.BROADCAST_PER_HOUR
import com.phonecando.runner.messages.MessageRules.BROADCAST_PER_MINUTE
import com.phonecando.runner.messages.MessageRules.DIRECT_PER_HOUR
import com.phonecando.runner.messages.MessageRules.DIRECT_PER_MINUTE
import com.phonecando.runner.messages.MessageRules.DUPLICATE_MS
import com.phonecando.runner.messages.MessageRules.HOUR_MS
import com.phonecando.runner.messages.MessageRules.MINUTE_MS
import com.phonecando.runner.messages.MessageRules.NO_WAKE_HOP
import com.phonecando.runner.messages.MessageRules.SCHEDULED_WAKE_TTL_MS
import com.phonecando.runner.messages.MessageRules.WAKES_PER_HOUR
import com.phonecando.runner.messages.MessageRules.WAKE_TTL_MS

// What agents may send and when a message may wake its recipient
// (MessageRules has the numbers):
// - Rate limits over sliding windows: a sender's direct messages to one
//   agent, 5 a minute and 30 an hour; its broadcasts, 2 a minute and 10 an
//   hour. Only sends that went out count.
// - The same text from the same sender to the same target within a minute
//   is dropped (a model retrying a call).
// - Waking: only a direct message (or a runner notice) whose sender asked
//   for it, asked under 10 minutes ago, with hop under 2, to an agent whose
//   "Other agents can wake it" is on, of a kind that can be woken, whose
//   engine runs (a stopped engine is never started) and has no run going or
//   question waiting, and which has been woken fewer than 6 times this hour.
// - A scheduled task's notice (ScheduledNote) is the user's or the agent's
//   own, not another agent's: it wakes whatever the switch, the hop and the
//   budget say, for 30 minutes; the kind must still wake, the engine run
//   and be idle.
// The windows live in memory: a new app process starts them afresh (the
// wake budget is seeded from the log). Pure: the clock is injected.
class MessagePolicy(private val clock: () -> Long) {
  private val sends = HashMap<String, ArrayDeque<Long>>()
  private val texts = HashMap<String, Long>()
  private val wakes = HashMap<String, ArrayDeque<Long>>()

  /** Why [from] may not send to [to] directly now; null when it may. */
  @Synchronized
  fun directRefusal(from: String, to: String): String? =
    limit("d $from $to", DIRECT_PER_MINUTE, DIRECT_PER_HOUR, "messages to this agent")

  /** Why [from] may not broadcast now; null when it may. */
  @Synchronized
  fun broadcastRefusal(from: String): String? =
    limit("b $from", BROADCAST_PER_MINUTE, BROADCAST_PER_HOUR, "broadcasts")

  /** The same [text] from [from] to [target] went out under a minute ago. */
  @Synchronized
  fun duplicate(from: String, target: String, text: String): Boolean {
    val at = texts[textKey(from, target, text)] ?: return false
    return clock() - at < DUPLICATE_MS
  }

  /** A direct message went out (counts toward its limits and the duplicate check). */
  @Synchronized
  fun sentDirect(from: String, to: String, text: String) {
    count("d $from $to")
    remember(from, to, text)
  }

  /** A broadcast to [target] went out. */
  @Synchronized
  fun sentBroadcast(from: String, target: String, text: String) {
    count("b $from")
    remember(from, target, text)
  }

  /** Wakes [agentId] has left this hour. */
  @Synchronized
  fun wakesLeft(agentId: String): Int = WAKES_PER_HOUR - window(wakes, agentId, HOUR_MS).size

  /** A message woke [agentId] at [at] (now by default; the log's times at start). */
  @Synchronized
  fun woke(agentId: String, at: Long = clock()) {
    wakes.getOrPut(agentId) { ArrayDeque() }.addLast(at)
  }

  private fun limit(key: String, perMinute: Int, perHour: Int, what: String): String? {
    val times = window(sends, key, HOUR_MS)
    val now = clock()
    if (times.count { now - it < MINUTE_MS } >= perMinute) return "too many $what this minute ($perMinute at most); wait a minute"
    if (times.size >= perHour) return "too many $what this hour ($perHour at most); wait, or tell the user"
    return null
  }

  private fun count(key: String) {
    sends.getOrPut(key) { ArrayDeque() }.addLast(clock())
  }

  private fun remember(from: String, target: String, text: String) {
    val now = clock()
    texts.entries.removeAll { now - it.value >= DUPLICATE_MS }
    texts[textKey(from, target, text)] = now
  }

  // The times in [map] under [key] within [spanMs] of now, older ones dropped.
  private fun window(map: HashMap<String, ArrayDeque<Long>>, key: String, spanMs: Long): ArrayDeque<Long> {
    val times = map.getOrPut(key) { ArrayDeque() }
    val now = clock()
    while (times.isNotEmpty() && now - times.first() >= spanMs) times.removeFirst()
    return times
  }

  private fun textKey(from: String, target: String, text: String) = "$from\u0000$target\u0000$text"

  /** What a wake depends on, for one message and its recipient now. */
  data class WakeCheck(
    /** The sender asked (a direct message's `wake`, or a notice that may wake). */
    val asked: Boolean,
    val broadcast: Boolean,
    val hop: Int,
    val sentAt: Long,
    /** The recipient's "Other agents can wake it". */
    val wakeable: Boolean,
    /** Its kind can be woken (the manifest's `inbox.wake`). */
    val kindCanWake: Boolean,
    /** For a kind that wakes through a hook it leaves waiting after a turn: that hook is alive. */
    val hookWaiting: Boolean = true,
    /** Its engine is ready. */
    val running: Boolean,
    /** No run going and no question waiting. */
    val idle: Boolean,
    val wakesLeft: Int,
    /** A scheduled task's notice (ScheduledNote). */
    val scheduled: Boolean = false,
  )

  companion object {
    /** Why the message may not wake its recipient now; null when it may. */
    fun wakeRefusal(c: WakeCheck, now: Long): String? = when {
      !c.asked -> "not asked"
      c.broadcast -> "a broadcast never wakes anyone"
      !c.scheduled && c.hop >= NO_WAKE_HOP -> "a reply to a reply never wakes anyone"
      now - c.sentAt > (if (c.scheduled) SCHEDULED_WAKE_TTL_MS else WAKE_TTL_MS) -> "asked too long ago"
      !c.scheduled && !c.wakeable -> "the user switched off waking it"
      !c.kindCanWake -> "its kind cannot be woken"
      !c.hookWaiting -> "it can be woken only while the hook it leaves after a turn is waiting, and none is waiting now"
      !c.running -> "it is stopped, and is never started by a message"
      !c.idle -> "it is busy"
      !c.scheduled && c.wakesLeft <= 0 -> "it was woken $WAKES_PER_HOUR times this hour"
      else -> null
    }
  }
}
