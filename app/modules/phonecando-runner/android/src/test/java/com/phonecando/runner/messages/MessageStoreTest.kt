package com.phonecando.runner.messages

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// The log file: appended lines where the last of an id wins, compaction
// on load within the caps, the sequence kept when everything aged out,
// broken lines skipped; and the in-memory log over it.
class MessageStoreTest {
  private val file = tempLog()
  private var now = 10L * 24 * 3600 * 1000

  @After fun cleanup() {
    file.parentFile.parentFile.deleteRecursively()
  }

  private fun msg(id: Long, sentAt: Long = now, status: DeliveryStatus = DeliveryStatus.QUEUED) = Message(
    id = id, from = "a", fromName = "A", fromKind = "claude-code", fromImage = "m1", to = "b", toName = "B",
    text = "hi $id", replyTo = null, sentAt = sentAt, hop = 0, wake = false, notice = false,
    deliveries = listOf(Delivery("b", "B", status, at = sentAt)),
  )

  @Test fun theLastLineOfAnIdWinsAndLoadCompacts() {
    val store = MessageStore(file)
    store.append(msg(1))
    store.append(msg(2))
    store.append(msg(1, status = DeliveryStatus.READ))
    file.appendText("not json\n{\"id\":0}\n\n")
    val loaded = MessageStore(file).load(now)
    assertEquals(listOf(1L, 2L), loaded.messages.map { it.id })
    assertEquals(DeliveryStatus.READ, loaded.messages[0].deliveries[0].status)
    assertEquals(3L, loaded.nextId)
    // One line per message after the sequence line.
    assertEquals(3, file.readLines().count { it.isNotBlank() })
    assertEquals(loaded.messages, MessageStore(file).load(now).messages)
  }

  @Test fun aScheduledTasksNoteRoundTrips() {
    val task = msg(1).copy(notice = true, scheduled = ScheduledNote("s0000000001", ScheduledNote.BY_AGENT, true, "every 2 h"))
    val store = MessageStore(file)
    store.append(task)
    store.append(msg(2))
    val loaded = MessageStore(file).load(now).messages
    assertEquals(task, loaded[0])
    assertEquals(null, loaded[1].scheduled)
  }

  @Test fun loadKeepsTheNewest500AndNoneOlderThanAWeek() {
    val store = MessageStore(file)
    store.append(msg(1, sentAt = now - MessageRules.LOG_MAX_AGE_MS - 1))
    for (id in 2L..601L) store.append(msg(id))
    val loaded = MessageStore(file).load(now)
    assertEquals(500, loaded.messages.size)
    assertEquals(102L, loaded.messages.first().id)
    assertEquals(602L, loaded.nextId)
  }

  @Test fun theSequenceOutlivesTheMessages() {
    val store = MessageStore(file)
    store.append(msg(41, sentAt = 0))
    assertEquals(42L, MessageStore(file).load(now).nextId)
    // Everything aged out, yet ids go on.
    val again = MessageStore(file).load(now)
    assertTrue(again.messages.isEmpty())
    assertEquals(42L, again.nextId)
  }

  @Test fun theLogMovesDeliveriesOnlyForward() {
    val log = MessageLog(MessageStore(file), { now })
    val m = log.add { id -> msg(id) }
    assertEquals(1L, m.id)
    log.mark("b", listOf(1), DeliveryStatus.READ)
    log.mark("b", listOf(1), DeliveryStatus.DELIVERED)
    assertEquals(DeliveryStatus.READ, log.get(1)!!.deliveries[0].status)
    assertEquals(emptyList<Long>(), log.readable("b", listOf(1)))
    // A fresh process reads it back, and the ids go on.
    val again = MessageLog(MessageStore(file), { now })
    assertEquals(DeliveryStatus.READ, again.get(1)!!.deliveries[0].status)
    assertEquals(2L, again.add { id -> msg(id) }.id)
  }

  @Test fun theLogCapsInMemoryAndForgetsAnAgent() {
    val log = MessageLog(MessageStore(file), { now })
    repeat(510) { log.add { id -> msg(id) } }
    assertEquals(500, log.newest(1000).size)
    assertEquals(510L, log.newest(1).single().id)
    log.forget("b")
    assertTrue(log.newest(1000).isEmpty())
    assertTrue(MessageLog(MessageStore(file), { now }).newest(1000).isEmpty())
  }
}
