package com.phonecando.runner.messages

import com.phonecando.runner.messages.delivery.Handover
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

// The mailbox end to end over a fake courier: send, hand over, read by
// receipt or inbox, broadcasts and names, waits, wakes and hops, the
// unread cap, server deliveries and a deleted agent.
class MailboxTest {
  private var now = 5_000_000L
  private val file = tempLog()
  private val a = agent("a", "Builder")
  private val b = agent("b", "Tester")
  private val c = agent("c", "Reviewer", image = "m2", kind = "opencode")
  private val view = FakeView(a, b, c)
  private val courier = FakeCourier()
  private var changes = 0
  private val box = mailbox()

  private fun mailbox() = Mailbox(MessageLog(MessageStore(file), { now }), view, courier, { now }, onChange = { changes++ })

  @After fun cleanup() {
    file.parentFile.parentFile.deleteRecursively()
  }

  @Test fun sendHandsItOverAndAReceiptReadsIt() {
    view.set("b", AgentState.WORKING)
    val sent = box.send(a, "tester", "  please run the tests​ ", replyTo = null, wake = false)
    assertEquals(1L, sent.id)
    assertEquals(SendStatus.QUEUED, sent.results.single().status)
    assertEquals("Tester", sent.results.single().to)
    assertTrue(sent.results.single().reason!!.contains("working"))
    val parcel = courier.last("b")!!
    assertEquals(listOf(1L), parcel.ids)
    assertFalse(parcel.wake)
    assertTrue(parcel.text.contains("please run the tests\n</agent-message>"))
    assertEquals("please run the tests", JSONObject(parcel.jsonl.trim()).getString("text"))
    assertEquals(1, box.unread("b"))
    assertEquals(mapOf("b" to 1), box.unreadCounts())

    box.receipt("b", listOf(1, 99))
    assertEquals(0, box.unread("b"))
    assertEquals(DeliveryStatus.READ, box.recent(1).single().deliveryTo("b")!!.status)
    assertTrue("b" in courier.cleared)
    assertTrue(changes >= 2)
  }

  @Test fun anIdleRecipientIsWokenOnlyWhenAsked() {
    val quiet = box.send(a, "Tester", "fyi", replyTo = null, wake = false)
    assertEquals(SendStatus.QUEUED, quiet.results.single().status)
    assertTrue(quiet.results.single().reason!!.contains("wake: true"))
    assertFalse(courier.last("b")!!.wake)
    val loud = box.send(a, "Tester", "need you", replyTo = null, wake = true)
    assertEquals(SendStatus.WOKEN, loud.results.single().status)
    assertTrue(courier.last("b")!!.wake)
    assertEquals(listOf(1L, 2L), courier.last("b")!!.ids)
    // The claim while idle is the wake: its run is another agent's, and
    // what it sends then is one hop on.
    box.receipt("b", listOf(1, 2))
    assertTrue(box.wakes.startedByAgent("b"))
    assertEquals(5, box.policy.wakesLeft("b"))
    assertTrue(box.recent(2).all { it.deliveryTo("b")!!.woke })
    box.send(b, "Builder", "done", replyTo = 2, wake = true)
    val reply = box.recent(1).single()
    assertEquals(1, reply.hop)
    assertEquals(2L, reply.replyTo)
    // Its run ends: hop 0 again.
    box.chatsChanged(setOf("b"))
    box.chatsChanged(emptySet())
    assertFalse(box.wakes.startedByAgent("b"))
  }

  @Test fun aWakeCountsByWhatTheAgentDidAsItsHookClaimed() {
    box.send(a, "Tester", "need you", replyTo = null, wake = true)
    val asClaimed = view.presence("b")
    // Its waiting hook raised the run it started before the receipt is handled.
    view.set("b", AgentState.WORKING)
    box.receipt("b", listOf(1), asClaimed)
    assertTrue(box.recent(1).single().deliveryTo("b")!!.woke)
    assertTrue(box.wakes.startedByAgent("b"))
  }

  @Test fun aClaimDuringARunIsNoWake() {
    box.send(a, "Tester", "need you", replyTo = null, wake = true)
    view.set("b", AgentState.WORKING)
    box.receipt("b", listOf(1), view.presence("b"))
    assertFalse(box.recent(1).single().deliveryTo("b")!!.woke)
    assertFalse(box.wakes.startedByAgent("b"))
  }

  @Test fun aReplyToAReplyNeverWakes() {
    box.wakes.woke("a", hop = 1, workingNow = true)
    val sent = box.send(a, "Tester", "again", replyTo = null, wake = true)
    assertEquals(2, box.recent(1).single().hop)
    assertEquals(SendStatus.QUEUED, sent.results.single().status)
    assertTrue(sent.results.single().reason!!.contains("not woken"))
    assertFalse(courier.last("b")!!.wake)
  }

  @Test fun noWakeForTheSwitchedOffTheStoppedTheBusyOrPastTheBudget() {
    view.records[1] = b.copy(wakeable = false)
    assertFalse(sendWake("1"))
    view.records[1] = b
    view.set("b", AgentState.STOPPED)
    assertFalse(sendWake("2"))
    view.set("b", AgentState.WAITING)
    assertFalse(sendWake("3"))
    view.set("b", AgentState.IDLE)
    view.canWake["claude-code"] = false
    assertFalse(sendWake("4"))
    view.canWake.clear()
    repeat(6) { box.policy.woke("b") }
    assertFalse(sendWake("5"))
  }

  private fun sendWake(text: String): Boolean {
    box.send(a, "Tester", text, replyTo = null, wake = true)
    return courier.last("b")!!.wake
  }

  @Test fun broadcastsGoToTheMachineOrThePhoneAndNeverWake() {
    val machine = box.send(a, "@machine", "rebasing main", replyTo = null, wake = true)
    assertEquals(listOf("Tester"), machine.results.map { it.to })
    assertEquals(Message.machine("m1"), box.recent(1).single().to)
    assertFalse(box.recent(1).single().wake)
    assertFalse(courier.last("b")!!.wake)
    val phone = box.send(a, "@phone", "anyone free?", replyTo = null, wake = false)
    assertEquals(listOf("Tester", "Reviewer"), phone.results.map { it.to })
    assertEquals(2, box.unread("b"))
    assertEquals(1, box.unread("c"))
    assertEquals(0, box.unread("a"))
    // The third in a minute is over the broadcast limit.
    val third = box.send(a, "@phone", "hello?", replyTo = null, wake = false)
    assertNull(third.id)
    assertEquals(SendStatus.REFUSED, third.results.single().status)
  }

  @Test fun namesResolveOrAreRefused() {
    view.records += agent("d", "tester", image = "m2", kind = "opencode")
    val twice = box.send(a, "Tester", "hi", replyTo = null, wake = false)
    assertEquals(SendStatus.REFUSED, twice.results.single().status)
    assertTrue(twice.results.single().reason!!, twice.results.single().reason!!.contains("id d"))
    assertEquals(SendStatus.QUEUED, box.send(a, "d", "by id", replyTo = null, wake = false).results.single().status)
    assertEquals("that is you", box.send(a, "builder", "me", replyTo = null, wake = false).results.single().reason)
    assertTrue(box.send(a, "nobody", "x", replyTo = null, wake = false).results.single().reason!!.contains("agents here"))
    assertEquals(SendStatus.REFUSED, box.send(a, "@Reviewer", "", replyTo = null, wake = false).results.single().status)
    assertEquals(SendStatus.QUEUED, box.send(a, "@Reviewer", "ok", replyTo = null, wake = false).results.single().status)
    assertEquals(SendStatus.REFUSED, box.send(a, "Reviewer", "x".repeat(4001), replyTo = null, wake = false).results.single().status)
    assertEquals(SendStatus.REFUSED, box.send(a, "Reviewer", "ok", replyTo = null, wake = false).results.single().status)
  }

  @Test fun inboxTakesTheOldestAndSaysWhetherMoreWait() {
    repeat(3) { box.send(a, "Tester", "m$it", replyTo = null, wake = false) }
    val first = box.inbox(b, 2)
    assertEquals(listOf("m0", "m1"), first.messages.map { it.text })
    assertTrue(first.more)
    assertEquals(listOf(3L), courier.last("b")!!.ids)
    val rest = box.inbox(b, 20)
    assertEquals(listOf("m2"), rest.messages.map { it.text })
    assertFalse(rest.more)
    assertTrue(box.inbox(b, 20).messages.isEmpty())
  }

  @Test fun waitReturnsAWaitingOneAtOnceAndBlocksForANewOne() {
    box.send(c, "Tester", "early", replyTo = null, wake = false)
    val got = box.wait(b, null, 10) as Mailbox.Waited.Got
    assertEquals("early", got.taken.messages.single().text)
    assertEquals(Mailbox.Waited.TimedOut, box.wait(b, null, 50))
    assertTrue(box.wait(b, "nobody", 10) is Mailbox.Waited.Refused)

    val started = CountDownLatch(1)
    var result: Mailbox.Waited? = null
    val waiter = thread {
      started.countDown()
      result = box.wait(b, "Builder", 5_000)
    }
    started.await()
    Thread.sleep(100)
    box.send(c, "Tester", "not from Builder", replyTo = null, wake = false)
    box.send(a, "Tester", "from Builder", replyTo = null, wake = false)
    waiter.join(TimeUnit.SECONDS.toMillis(5))
    assertEquals("from Builder", (result as Mailbox.Waited.Got).taken.messages.single().text)
    assertTrue((result as Mailbox.Waited.Got).taken.more)
  }

  @Test fun pastFiftyUnreadTheOldestAreDroppedWithANotice() {
    val many = (0 until 60).map { agent("s$it", "S$it") }
    view.records += many
    for (s in many.take(51)) box.send(s, "Tester", "from ${s.name}", replyTo = null, wake = false)
    assertEquals(50, box.unread("b"))
    val log = box.recent(100)
    val notice = log.first { it.notice }
    assertTrue(notice.text.startsWith("2 older messages to you were dropped unread"))
    assertEquals(DeliveryStatus.REFUSED, log.first { it.text == "from S0" }.deliveryTo("b")!!.status)
  }

  @Test fun aServerThatTakesThemDeliversOrWakes() {
    courier.answers["c"] = Handover.POSTED
    view.set("c", AgentState.WORKING)
    assertEquals(SendStatus.DELIVERED, box.send(a, "Reviewer", "look", replyTo = null, wake = false).results.single().status)
    assertEquals(DeliveryStatus.DELIVERED, box.recent(1).single().deliveryTo("c")!!.status)
    assertEquals(0, box.unread("c"))
    courier.answers["c"] = Handover.WOKE
    view.set("c", AgentState.IDLE)
    assertEquals(SendStatus.WOKEN, box.send(a, "Reviewer", "wake up", replyTo = null, wake = true).results.single().status)
    assertTrue(box.recent(1).single().deliveryTo("c")!!.woke)
    assertTrue(box.wakes.startedByAgent("c"))
    assertEquals(5, box.policy.wakesLeft("c"))
  }

  @Test fun aClaimedSetIsDeliveredAndLeftOut() {
    box.send(a, "Tester", "one", replyTo = null, wake = false)
    courier.claims["b"] = setOf(1L)
    box.send(a, "Tester", "two", replyTo = null, wake = false)
    assertEquals(listOf(2L), courier.last("b")!!.ids)
    assertEquals(DeliveryStatus.DELIVERED, box.recent(2).last().deliveryTo("b")!!.status)
    assertEquals(1, box.unread("b"))
  }

  @Test fun noticesComeFromPhoneCanDoAndMayWake() {
    box.notice("b", "The screen is yours now.", wake = true)
    val n = box.recent(1).single()
    assertTrue(n.notice)
    assertEquals(Message.RUNNER, n.from)
    assertTrue(courier.last("b")!!.wake)
    assertTrue(courier.last("b")!!.text.startsWith("<phonecando-notice id=\"1\">"))
  }

  @Test fun aDeletedAgentsMessagesGoAndTheLogKeepsWhatItSent() {
    box.send(a, "Tester", "to b", replyTo = null, wake = false)
    box.send(b, "Builder", "from b", replyTo = null, wake = false)
    box.send(a, "@phone", "to all", replyTo = null, wake = false)
    box.forget("b")
    val log = mailbox().recent(10)
    assertEquals(listOf("to all", "from b"), log.map { it.text })
    assertEquals(listOf("c"), log[0].deliveries.map { it.agentId })
    assertEquals("Tester", log[1].fromName)
  }

  @Test fun theWakeBudgetOutlivesTheProcess() {
    courier.answers["c"] = Handover.WOKE
    box.send(a, "Reviewer", "wake", replyTo = null, wake = true)
    assertEquals(5, mailbox().policy.wakesLeft("c"))
  }

  @Test fun anAgentThatCannotReadIsRefusedAndTheLogSaysWhy() {
    view.levels["aider"] = com.phonecando.agents.kit.MessagingLevel.NONE
    val d = agent("d", "Pair", kind = "aider")
    view.records.add(d)
    val sent = box.send(a, "Pair", "hello", replyTo = null, wake = true)
    val result = sent.results.single()
    assertEquals(SendStatus.REFUSED, result.status)
    assertTrue(result.reason!!.contains("can't read messages"))
    assertNull(courier.last("d"))
    assertEquals(0, box.unread("d"))
    val logged = box.recent(1).single().deliveryTo("d")!!
    assertEquals(DeliveryStatus.REFUSED, logged.status)
    assertTrue(logged.reason!!.contains("phone tools"))
  }

  @Test fun aBroadcastSkipsAgentsThatCannotRead() {
    view.levels["aider"] = com.phonecando.agents.kit.MessagingLevel.NONE
    view.records.add(agent("d", "Pair", kind = "aider"))
    val sent = box.send(a, "@machine", "standup in 5", replyTo = null, wake = false)
    val byName = sent.results.associateBy { it.to }
    assertEquals(SendStatus.REFUSED, byName.getValue("Pair").status)
    assertTrue(byName.getValue("Tester").status != SendStatus.REFUSED)
    assertNull(courier.last("d"))
  }

  @Test fun aPullOnlyAgentReadsItWithItsInboxTool() {
    view.levels["goose"] = com.phonecando.agents.kit.MessagingLevel.INBOX
    view.records.add(agent("e", "Goose", kind = "goose"))
    val sent = box.send(a, "Goose", "ping", replyTo = null, wake = false)
    assertEquals(SendStatus.QUEUED, sent.results.single().status)
    assertTrue(sent.results.single().reason!!.contains("agents_inbox"))
  }

  @Test fun aHookWakeWithNoHookWaitingIsNotAWake() {
    view.waiters["b"] = false
    val sent = box.send(a, "Tester", "need you", replyTo = null, wake = true)
    assertEquals(SendStatus.QUEUED, sent.results.single().status)
    assertTrue(sent.results.single().reason!!.contains("none is waiting now"))
  }


  @Test fun aNameAsAMessageShowsItReachesTheAgent() {
    val sent = box.send(a, "Tester (Claude Code)", "hi", replyTo = null, wake = false)
    assertEquals("Tester", sent.results.single().to)
    assertTrue(sent.results.single().status != SendStatus.REFUSED)
  }

}
