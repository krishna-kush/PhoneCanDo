package com.phonecando.runner.messages

import com.phonecando.runner.messages.delivery.Handover
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// What a sender hears about one recipient, by how its message went.
class SendReportTest {
  private fun message(wake: Boolean) = Message(
    id = 47, from = "a", fromName = "Builder", fromKind = "opencode", fromImage = "m1", to = "b", toName = "Tester",
    text = "status?", replyTo = 45, sentAt = 0, hop = 0, wake = wake, notice = false, deliveries = emptyList(),
  )

  private fun report(handover: Handover, wake: Boolean, wakeRefusal: String?, presence: AgentState = AgentState.WORKING) = SendReport.of(
    name = "Tester",
    message = message(wake),
    handover = handover,
    presence = Presence(presence),
    wakeRefusal = wakeRefusal,
    folderWakes = false,
    wakeHelps = true,
  )

  @Test fun aWakeThatWentIntoItsChatSaysWhyItDidNotWake() {
    val sent = report(Handover.POSTED, wake = true, wakeRefusal = "it is busy")
    assertEquals(SendStatus.DELIVERED, sent.status)
    assertEquals("in its chat; not woken: it is busy; it reads this at its next turn", sent.reason)
    // One that did not ask to wake is just delivered.
    assertNull(report(Handover.POSTED, wake = false, wakeRefusal = "not asked").reason)
  }

  @Test fun aWakeOrAStartTellsTheSenderNotToWait() {
    for (handover in listOf(Handover.WOKE, Handover.SWITCHING, Handover.STARTING)) {
      val sent = report(handover, wake = true, wakeRefusal = null, presence = AgentState.IDLE)
      assertEquals(SendStatus.WOKEN, sent.status)
      assertTrue(sent.reason!!.endsWith(SendReport.DONT_WAIT))
    }
  }
}
