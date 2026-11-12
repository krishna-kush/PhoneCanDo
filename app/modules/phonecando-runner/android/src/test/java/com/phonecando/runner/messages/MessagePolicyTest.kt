package com.phonecando.runner.messages

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// The numbers agents hold to, the rate limits over their windows, the
// duplicate check and every reason a message may not wake its recipient.
class MessagePolicyTest {
  private var now = 1_000_000L
  private val policy = MessagePolicy { now }

  @Test fun theNumbers() {
    assertEquals(4000, MessageRules.MAX_CHARS)
    assertEquals(500, MessageRules.LOG_MAX)
    assertEquals(7L * 24 * 3600 * 1000, MessageRules.LOG_MAX_AGE_MS)
    assertEquals(50, MessageRules.UNREAD_MAX)
    assertEquals(5, MessageRules.DIRECT_PER_MINUTE)
    assertEquals(30, MessageRules.DIRECT_PER_HOUR)
    assertEquals(2, MessageRules.BROADCAST_PER_MINUTE)
    assertEquals(10, MessageRules.BROADCAST_PER_HOUR)
    assertEquals(60_000L, MessageRules.DUPLICATE_MS)
    assertEquals(6, MessageRules.WAKES_PER_HOUR)
    assertEquals(2, MessageRules.NO_WAKE_HOP)
    assertEquals(30, MessageRules.WAIT_MAX_SEC)
  }

  @Test fun directMessagesAreLimitedPerRecipient() {
    repeat(5) {
      assertNull(policy.directRefusal("a", "b"))
      policy.sentDirect("a", "b", "m$it")
    }
    assertTrue(policy.directRefusal("a", "b")!!.contains("this minute"))
    // Another recipient, or another sender, has its own window.
    assertNull(policy.directRefusal("a", "c"))
    assertNull(policy.directRefusal("c", "b"))
    // A minute on the minute's window is clear, the hour's is not yet.
    for (minute in 1..5) {
      now += 60_000
      repeat(5) {
        assertNull("minute $minute", policy.directRefusal("a", "b"))
        policy.sentDirect("a", "b", "m$minute-$it")
      }
    }
    now += 60_000
    assertTrue(policy.directRefusal("a", "b")!!.contains("this hour"))
    now += 3_600_000
    assertNull(policy.directRefusal("a", "b"))
  }

  @Test fun broadcastsAreLimitedPerSender() {
    repeat(2) {
      assertNull(policy.broadcastRefusal("a"))
      policy.sentBroadcast("a", Message.PHONE, "b$it")
    }
    assertNotNull(policy.broadcastRefusal("a"))
    assertNull(policy.directRefusal("a", "b"))
    repeat(4) {
      now += 60_000
      repeat(2) { i -> policy.sentBroadcast("a", Message.machine("m1"), "x$it$i") }
    }
    now += 60_000
    assertTrue(policy.broadcastRefusal("a")!!.contains("this hour"))
  }

  @Test fun theSameTextToTheSameTargetWithinAMinuteIsADuplicate() {
    policy.sentDirect("a", "b", "hello")
    assertTrue(policy.duplicate("a", "b", "hello"))
    assertFalse(policy.duplicate("a", "b", "hello again"))
    assertFalse(policy.duplicate("a", "c", "hello"))
    assertFalse(policy.duplicate("c", "b", "hello"))
    now += 60_000
    assertFalse(policy.duplicate("a", "b", "hello"))
  }

  @Test fun sixWakesAnHour() {
    repeat(6) {
      assertEquals(6 - it, policy.wakesLeft("b"))
      policy.woke("b")
      now += 1_000
    }
    assertEquals(0, policy.wakesLeft("b"))
    assertEquals(6, policy.wakesLeft("c"))
    now += 3_600_000
    assertEquals(6, policy.wakesLeft("b"))
    // Seeded from the log at start.
    policy.woke("d", now - 3_599_000)
    assertEquals(5, policy.wakesLeft("d"))
  }

  @Test fun everyReasonNotToWake() {
    val ok = MessagePolicy.WakeCheck(
      asked = true, broadcast = false, hop = 1, sentAt = now, wakeable = true,
      kindCanWake = true, running = true, idle = true, wakesLeft = 1,
    )
    assertNull(MessagePolicy.wakeRefusal(ok, now))
    val refusals = listOf(
      ok.copy(asked = false),
      ok.copy(broadcast = true),
      ok.copy(hop = 2),
      ok.copy(sentAt = now - MessageRules.WAKE_TTL_MS - 1),
      ok.copy(wakeable = false),
      ok.copy(kindCanWake = false),
      ok.copy(running = false),
      ok.copy(idle = false),
      ok.copy(wakesLeft = 0),
    ).map { MessagePolicy.wakeRefusal(it, now) }
    assertTrue(refusals.all { it != null })
    assertEquals(refusals.size, refusals.toSet().size)
  }
}
