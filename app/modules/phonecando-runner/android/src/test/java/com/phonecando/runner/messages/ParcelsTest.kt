package com.phonecando.runner.messages

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// One hand-over carries the oldest messages that fit about 8 KB, at least
// one, and says how many still wait.
class ParcelsTest {
  private val label = { kind: String -> kind }

  private fun msg(id: Long, chars: Int, wake: Boolean = false) = Message(
    id = id, from = "a", fromName = "A", fromKind = "k", fromImage = "m1", to = "b", toName = "B",
    text = "x".repeat(chars), replyTo = null, sentAt = 0, hop = 0, wake = wake, notice = false, deliveries = emptyList(),
  )

  @Test fun smallSetsGoWhole() {
    val p = Parcels.build(listOf(msg(1, 10), msg(2, 10)), "m1", label) { false }
    assertEquals(listOf(1L, 2L), p.ids)
    assertFalse(p.text.contains("waiting"))
    assertTrue(p.text.endsWith(Renderer.TRAILER))
    assertEquals(2, p.jsonl.trim().lines().size)
  }

  @Test fun bigSetsAreCutAtAbout8KbAndSaySo() {
    val unread = (1L..50L).map { msg(it, 4000) }
    val p = Parcels.build(unread, "m1", label) { it.id == 50L }
    assertEquals(listOf(1L), p.ids)
    assertTrue(p.text.endsWith("49 more agent messages waiting: call agents_inbox."))
    // A held-back message that may wake still wakes the agent for this one.
    assertTrue(p.wake)
    assertEquals(1L, JSONObject(p.jsonl.trim()).getLong("id"))

    val mid = Parcels.build((1L..5L).map { msg(it, 3000) }, "m1", label) { false }
    assertEquals(listOf(1L, 2L), mid.ids)
    assertTrue(mid.text.endsWith("3 more agent messages waiting: call agents_inbox."))
    assertTrue(mid.text.toByteArray().size < Parcels.MAX_BYTES + 200)
    assertTrue(Parcels.build(listOf(msg(1, 4000), msg(2, 4000)), "m1", label) { false }.text.contains("1 more agent message waiting"))
  }
}
