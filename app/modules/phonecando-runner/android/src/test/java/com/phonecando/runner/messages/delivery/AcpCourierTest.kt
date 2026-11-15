package com.phonecando.runner.messages.delivery

import com.phonecando.runner.engine.acp.AcpAgentHandle
import com.phonecando.runner.engine.acp.AcpSnapshot
import com.phonecando.runner.engine.acp.AcpTurnEnd
import com.phonecando.runner.messages.agent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// A set goes into an agent in ACP mode as one prompt: in a new chat when a
// scheduled task asks for one, never while a turn runs, and a refusal makes
// a retry wait.
class AcpCourierTest {
  private class Handle(override var busy: Boolean = false, var takes: Boolean = true) : AcpAgentHandle {
    override var waitingForWork = false
    val prompts = ArrayList<Triple<String, Boolean, String?>>()
    override val agentId = "b"
    override val chatId: String? = "chat-1"

    override fun prompt(text: String, newChat: Boolean, title: String?, done: (AcpTurnEnd) -> Unit): Boolean {
      prompts += Triple(text, newChat, title)
      return takes
    }

    override fun cancel() {}

    override fun answerPermission(requestId: String, optionId: String?): Boolean = false

    override fun snapshot(): AcpSnapshot = AcpSnapshot(chatId, busy, emptyList(), null)
  }

  private var now = 1_000_000L
  private val b = agent("b", "Tester")
  private var handle: Handle? = Handle()
  private val courier = AcpCourier({ handle }, clock = { now })
  private val parcel = Parcel(listOf(1, 2), "two messages", "{}\n", wake = true)

  @Test fun aPromptItTakesStartsItsTurn() {
    assertEquals(Handover.WOKE, courier.handOver(b, parcel))
    assertEquals(Triple("two messages", false, null), handle!!.prompts.single())
    assertTrue(courier.claimed(b).isEmpty())
  }

  @Test fun aScheduledTaskThatAsksForANewChatGetsOne() {
    assertEquals(Handover.WOKE, courier.handOver(b, parcel.copy(newChat = "Scheduled: check CI")))
    assertEquals(Triple("two messages", true, "Scheduled: check CI"), handle!!.prompts.single())
  }

  @Test fun busyOrNotReadyTakesNothing() {
    handle!!.busy = true
    assertEquals(Handover.NONE, courier.handOver(b, parcel))
    assertTrue(handle!!.prompts.isEmpty())
    handle = null
    assertEquals(Handover.NONE, courier.handOver(b, parcel))
  }

  @Test fun anEngineStartedForAMessageTakesItWhileItWaitsForIt() {
    handle!!.busy = true
    handle!!.waitingForWork = true
    assertEquals(Handover.WOKE, courier.handOver(b, parcel))
    assertEquals(1, handle!!.prompts.size)
  }

  @Test fun aRefusedPromptMakesARetryWait() {
    handle!!.takes = false
    assertEquals(Handover.NONE, courier.handOver(b, parcel))
    handle!!.takes = true
    assertEquals(Handover.NONE, courier.handOver(b, parcel, retry = true))
    assertEquals(1, handle!!.prompts.size)
    // A new message does not wait.
    assertEquals(Handover.WOKE, courier.handOver(b, parcel))
    handle!!.takes = false
    courier.handOver(b, parcel)
    now += AcpCourier.RETRY_MS
    handle!!.takes = true
    assertEquals(Handover.WOKE, courier.handOver(b, parcel, retry = true))
  }
}
