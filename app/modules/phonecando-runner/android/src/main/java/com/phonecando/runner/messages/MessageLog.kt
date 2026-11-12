package com.phonecando.runner.messages

import java.io.IOException
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

// The messages in memory, kept in step with the file (MessageStore): every
// new or changed message is appended, the oldest go past the caps (newest
// LOG_MAX, none older than LOG_MAX_AGE_MS; from the file at its next
// rewrite, once it has grown COMPACT_LINES or at the next start). A
// delivery only moves on (queued, delivered, read; refused stays), and
// unread is queued. Thread-safe: one lock, and a condition that wakes a
// waiter (await) whenever a message is added. Pure apart from the store.
class MessageLog(
  private val store: MessageStore,
  private val clock: () -> Long,
  private val onError: (String, Throwable) -> Unit = { _, _ -> },
) {
  private val lock = ReentrantLock()
  private val added = lock.newCondition()
  private val messages = LinkedHashMap<Long, Message>()
  private var nextId: Long

  init {
    val loaded = store.load(clock())
    loaded.messages.forEach { messages[it.id] = it }
    nextId = loaded.nextId
  }

  /** A new message with the next id ([build] runs under the lock); wakes the waiters. */
  fun add(build: (id: Long) -> Message): Message = lock.withLock {
    val m = build(nextId++)
    put(m)
    added.signalAll()
    m
  }

  /** An id this log handed out (the message may have aged out since). */
  fun issued(id: Long): Boolean = lock.withLock { id in 1 until nextId }

  fun get(id: Long): Message? = lock.withLock { messages[id] }

  /** [agentId]'s unread messages, oldest first. */
  fun unread(agentId: String): List<Message> = lock.withLock { unreadLocked(agentId) }

  /** Moves [agentId]'s deliveries of [ids] on to [status] ([woke]: that started its run), never back. */
  fun mark(agentId: String, ids: Collection<Long>, status: DeliveryStatus, woke: Boolean = false) {
    lock.withLock { markLocked(agentId, ids, status, woke) }
  }

  /** Of [ids], those [agentId] has not read yet (queued or delivered). */
  fun readable(agentId: String, ids: List<Long>): List<Long> = lock.withLock {
    ids.filter { messages[it]?.deliveryTo(agentId)?.status.let { s -> s == DeliveryStatus.QUEUED || s == DeliveryStatus.DELIVERED } }
  }

  /** Up to [limit] of [agentId]'s unread, now read, and whether more are unread. */
  fun take(agentId: String, limit: Int): Pair<List<Message>, Boolean> = lock.withLock {
    val unread = unreadLocked(agentId)
    val some = unread.take(limit)
    markLocked(agentId, some.map { it.id }, DeliveryStatus.READ, false)
    some to (unread.size > some.size)
  }

  /**
   * The first of [agentId]'s unread that [accept] takes, now read, with
   * whether more are unread; waits for one until [deadlineNanos]
   * (System.nanoTime), null when none came.
   */
  fun awaitFirst(agentId: String, deadlineNanos: Long, accept: (Message) -> Boolean): Pair<Message, Boolean>? = lock.withLock {
    var found: Pair<Message, Boolean>? = null
    while (found == null) {
      val unread = unreadLocked(agentId)
      val first = unread.firstOrNull(accept)
      if (first != null) {
        markLocked(agentId, listOf(first.id), DeliveryStatus.READ, false)
        found = first to (unread.size > 1)
      } else {
        val left = deadlineNanos - System.nanoTime()
        if (left <= 0) break
        added.awaitNanos(left)
      }
    }
    found
  }

  /** Refuses [agentId]'s oldest unread past [keep] with [reason]; how many. */
  fun dropOldest(agentId: String, keep: Int, reason: String): Int = lock.withLock {
    val unread = unreadLocked(agentId)
    val drop = unread.take((unread.size - keep).coerceAtLeast(0))
    val now = clock()
    for (m in drop) put(m.withDelivery(agentId) { it.copy(status = DeliveryStatus.REFUSED, reason = reason, at = now) })
    drop.size
  }

  /** Every agent with unread messages, and how many. */
  fun unreadCounts(): Map<String, Int> = lock.withLock {
    val counts = LinkedHashMap<String, Int>()
    for (m in messages.values) for (d in m.deliveries) if (d.unread) counts[d.agentId] = (counts[d.agentId] ?: 0) + 1
    counts
  }

  /** The newest [limit], newest first. */
  fun newest(limit: Int): List<Message> = lock.withLock { messages.values.toList().takeLast(limit.coerceAtLeast(0)).reversed() }

  /** When each agent was woken by messages (distinct times), for the wake budget. */
  fun wokeAt(): List<Pair<String, Long>> = lock.withLock {
    messages.values.flatMap { m -> m.deliveries.filter { it.woke }.map { it.agentId to it.at } }.distinct().sortedBy { it.second }
  }

  /** Drops every delivery to [agentId], and the messages that had no other recipient; rewrites the file. */
  fun forget(agentId: String) {
    lock.withLock {
      for (m in messages.values.toList()) {
        if (m.deliveryTo(agentId) == null) continue
        val rest = m.deliveries.filter { it.agentId != agentId }
        if (rest.isEmpty()) messages.remove(m.id) else messages[m.id] = m.copy(deliveries = rest)
      }
      rewrite()
    }
  }

  // ---- lock held -----------------------------------------------------------------

  private fun unreadLocked(agentId: String): List<Message> = messages.values.filter { it.deliveryTo(agentId)?.unread == true }

  private fun markLocked(agentId: String, ids: Collection<Long>, status: DeliveryStatus, woke: Boolean) {
    val now = clock()
    for (id in ids) {
      val m = messages[id] ?: continue
      val d = m.deliveryTo(agentId) ?: continue
      if (d.status == DeliveryStatus.REFUSED || d.status.ordinal >= status.ordinal) continue
      put(m.withDelivery(agentId) { it.copy(status = status, woke = it.woke || woke, at = now) })
    }
  }

  private fun put(m: Message) {
    messages[m.id] = m
    try {
      store.append(m)
    } catch (e: IOException) {
      onError("message ${m.id} not saved", e)
    }
    val now = clock()
    while (messages.size > MessageRules.LOG_MAX) messages.remove(messages.keys.first())
    while (messages.isNotEmpty() && now - messages.values.first().sentAt > MessageRules.LOG_MAX_AGE_MS) {
      messages.remove(messages.keys.first())
    }
    if (store.appended > MessageStore.COMPACT_LINES) rewrite()
  }

  private fun rewrite() {
    try {
      store.rewrite(MessageStore.trim(messages.values.toList(), clock()), nextId)
    } catch (e: IOException) {
      onError("message log not rewritten", e)
    }
  }
}
