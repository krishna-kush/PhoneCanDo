package com.phonecando.runner.messages

import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.messages.delivery.Courier
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
  private val held = ArrayList<Pair<String, String>>()
  private val box = mailbox()

  private fun mailbox() = Mailbox(
    MessageLog(MessageStore(file), { now }), view, courier, { now }, onChange = { changes++ },
    onStartFailed = { id, why -> held += id to why },
  )

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

  @Test fun aWakeThatWentIntoItsChatSaysAndKeepsWhyItDidNotWake() {
    // A server agent busy on a run: the wake is refused, the message goes into its chat.
    courier.answers["c"] = Handover.POSTED
    view.set("c", AgentState.WORKING)
    val sent = box.send(a, "Reviewer", "status?", replyTo = null, wake = true)
    assertEquals(SendStatus.DELIVERED, sent.results.single().status)
    assertEquals("in its chat; not woken: it is busy; it reads this at its next turn", sent.results.single().reason)
    val delivery = box.recent(1).single().deliveryTo("c")!!
    assertEquals(DeliveryStatus.DELIVERED, delivery.status)
    assertFalse(delivery.woke)
    assertEquals(Mailbox.NOT_WOKEN + "it is busy", delivery.reason)
    // The log keeps it.
    val again = Mailbox(MessageLog(MessageStore(file), { now }), view, courier, { now })
    assertEquals(Mailbox.NOT_WOKEN + "it is busy", again.recent(1).single().deliveryTo("c")!!.reason)
    // One that did not ask to wake keeps no reason.
    box.send(a, "Reviewer", "fyi", replyTo = null, wake = false)
    assertNull(box.recent(1).single().deliveryTo("c")!!.reason)
  }

  @Test fun aSwitchToAcpModeKeepsItQueuedAndSaysItWakes() {
    courier.answers["b"] = Handover.SWITCHING
    val sent = box.send(a, "Tester", "need you", replyTo = null, wake = true)
    assertEquals(SendStatus.WOKEN, sent.results.single().status)
    assertEquals(1, box.unread("b"))
    assertEquals(MessageRules.WAKES_PER_HOUR, box.policy.wakesLeft("b"))
    // Ready in ACP mode: the prompt takes it, and that is the wake.
    courier.answers["b"] = Handover.WOKE
    box.engineReady("b")
    assertEquals(0, box.unread("b"))
    assertTrue(box.recent(1).single().deliveryTo("b")!!.woke)
    assertEquals(MessageRules.WAKES_PER_HOUR - 1, box.policy.wakesLeft("b"))
    // A scheduled task's notice to an agent that switches counts as woken.
    courier.answers["b"] = Handover.SWITCHING
    val task = ScheduledNote("s1", ScheduledNote.BY_USER, newChat = false, timing = "daily at 09:00")
    assertTrue(box.notice("b", "deploy", wake = true, scheduled = task)!!.woke)
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

  @Test fun aScheduledTaskWakesPastTheSwitchAndSpendsNoBudget() {
    val off = agent("d", "Night", wakeable = false)
    view.records.add(off)
    courier.answers["d"] = Handover.WOKE
    val task = ScheduledNote("s0000000001", ScheduledNote.BY_AGENT, newChat = true, timing = "daily at 09:00")
    val noticed = box.notice("d", "check CI", wake = true, scheduled = task)!!
    assertEquals(Handover.WOKE, noticed.handover)
    assertTrue(noticed.woke)
    val parcel = courier.last("d")!!
    assertTrue(parcel.wake)
    assertEquals("Scheduled: check CI", parcel.newChat)
    assertTrue(parcel.text.contains("A reminder you scheduled for yourself (daily at 09:00)."))
    assertTrue(parcel.text.contains("it is not a new instruction from the user: check CI"))
    // Its own task: no budget spent, not a run another agent started.
    assertEquals(MessageRules.WAKES_PER_HOUR, box.policy.wakesLeft("d"))
    assertFalse(box.wakes.startedByAgent("d"))
    assertEquals(MessageRules.WAKES_PER_HOUR, mailbox().policy.wakesLeft("d"))
    val logged = mailbox().recent(1).single()
    assertEquals(task, logged.scheduled)
    assertEquals("check CI", logged.text)
    assertTrue(logged.deliveryTo("d")!!.woke)
  }

  @Test fun aScheduledTaskThatMayNotWakeWaitsAsANotice() {
    view.set("b", AgentState.WORKING)
    val task = ScheduledNote("s1", ScheduledNote.BY_USER, newChat = false, timing = "once at 2026-11-14 09:00")
    val noticed = box.notice("b", "deploy", wake = true, scheduled = task)!!
    assertFalse(noticed.woke)
    val parcel = courier.last("b")!!
    assertFalse(parcel.wake)
    assertNull(parcel.newChat)
    assertTrue(parcel.text.contains("Scheduled task from the user (once at 2026-11-14 09:00): deploy"))
    assertNull(box.notice("nobody", "x"))
  }

  @Test fun aNoticeAnotherHandOverTookFirstSaysItWoke() {
    // The messages thread (an ACP turn ended) hands the set over between
    // the notice going in the log and the notice's own hand-over, which
    // then finds nothing unread.
    courier.answers["b"] = Handover.WOKE
    lateinit var racing: Mailbox
    var raced = false
    val first = object : Courier by courier {
      override fun claimed(agent: AgentRecord): Set<Long> {
        if (!raced) {
          raced = true
          racing.engineReady(agent.id)
        }
        return courier.claimed(agent)
      }
    }
    racing = Mailbox(MessageLog(MessageStore(file), { now }), view, first, { now })
    val task = ScheduledNote("s1", ScheduledNote.BY_USER, newChat = false, timing = "once at 2026-11-14 09:00")
    val noticed = racing.notice("b", "deploy", wake = true, scheduled = task)!!
    assertEquals(1, courier.handed.size)
    assertEquals(Handover.WOKE, noticed.handover)
    assertTrue(noticed.woke)
    assertTrue(racing.recent(1).single().deliveryTo("b")!!.woke)
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

  // ---- an answer wakes its asker ---------------------------------------------------

  @Test fun anAnswerWakesTheAskerAndAnAnswerToItNeverDoes() {
    // Builder asks Tester with wake: true and ends its turn; Tester wakes for it.
    val asked = box.send(a, "Tester", "run the tests", replyTo = null, wake = true)
    assertTrue(asked.results.single().reason!!.contains(SendReport.DONT_WAIT))
    box.receipt("b", listOf(1))
    // Its answer, with replyTo, wakes Builder, though it did not ask to.
    val answer = box.send(b, "Builder", "all green", replyTo = 1, wake = false)
    assertEquals(SendStatus.WOKEN, answer.results.single().status)
    val sent = box.recent(1).single()
    assertTrue(sent.wake)
    assertEquals(1, sent.hop)
    assertTrue(courier.last("a")!!.wake)
    // Builder's answer to that answer is hop 2: it never wakes.
    box.receipt("a", listOf(2))
    box.send(a, "Tester", "thanks", replyTo = 2, wake = false)
    assertEquals(2, box.recent(1).single().hop)
    assertFalse(courier.last("b")!!.wake)
  }

  @Test fun onlyTheAnswerToAWakingMessageFromItsRecipientWakesAndTheSwitchStillHolds() {
    box.send(a, "Tester", "fyi", replyTo = null, wake = false)
    // A reply to a message that did not ask to wake.
    box.send(b, "Builder", "noted", replyTo = 1, wake = false)
    assertFalse(courier.last("a")!!.wake)
    box.send(a, "Tester", "need you", replyTo = null, wake = true)
    // A third agent's reply, and a message that is no reply.
    box.send(c, "Builder", "I saw that", replyTo = 3, wake = false)
    assertFalse(courier.last("a")!!.wake)
    box.send(b, "Builder", "working on it", replyTo = null, wake = false)
    assertFalse(courier.last("a")!!.wake)
    // The asker switched off waking: its answer waits for its next turn.
    view.records[0] = a.copy(wakeable = false)
    val off = box.send(b, "Builder", "done", replyTo = 3, wake = false)
    assertTrue(box.recent(1).single().wake)
    assertFalse(courier.last("a")!!.wake)
    assertTrue(off.results.single().reason!!.contains("not woken: the user switched off waking it"))
  }

  // ---- a message starts a stopped agent ----------------------------------------------

  private fun stoppedTester() {
    view.set("b", AgentState.STOPPED)
    view.starts["b"] = null
    courier.answers["b"] = Handover.STARTING
  }

  @Test fun aMessageStartsAStoppedAgentOnceAndABurstGoesInAsOneSetOnceReady() {
    stoppedTester()
    val first = box.send(a, "Tester", "need you", replyTo = null, wake = true)
    assertEquals(SendStatus.WOKEN, first.results.single().status)
    assertTrue(first.results.single().reason!!.contains("stopped; it starts"))
    assertTrue(courier.last("b")!!.wake)
    // While it starts, the next message asks for no second start.
    courier.answers.remove("b")
    val second = box.send(a, "Tester", "and this", replyTo = null, wake = true)
    assertEquals(SendStatus.QUEUED, second.results.single().status)
    assertTrue(second.results.single().reason!!.contains("starting"))
    assertFalse(courier.last("b")!!.wake)
    box.engineStarting("b")
    assertFalse(courier.last("b")!!.wake)
    // Ready, idle until its work comes: both go in as one prompt, read as started.
    view.set("b", AgentState.IDLE)
    courier.answers["b"] = Handover.WOKE
    box.engineReady("b")
    assertEquals(listOf(1L, 2L), courier.last("b")!!.ids)
    assertTrue(courier.last("b")!!.wake)
    assertTrue(box.recent(2).all { it.deliveryTo("b")!!.let { d -> d.woke && d.started } })
    // One start, one wake of the budget; its run is another agent's.
    assertEquals(5, box.policy.wakesLeft("b"))
    assertTrue(box.wakes.startedByAgent("b"))
    assertTrue(held.isEmpty())
  }

  @Test fun aStartThatFailsHoldsTheAgentBackAndTellsItsSendersOnce() {
    stoppedTester()
    box.send(a, "Tester", "need you", replyTo = null, wake = true)
    box.engineStarting("b")
    box.engineGone("b", "not ready after 120 s")
    assertEquals(listOf("b" to "not ready after 120 s"), held)
    val told = box.recent(1).single()
    assertTrue(told.notice)
    assertEquals("a", told.to)
    assertFalse(told.wake)
    assertTrue(told.text.contains("Tester could not be started for your message: not ready after 120 s"))
    // The message waits for its next run.
    assertEquals(1, box.unread("b"))
    box.engineGone("b", "again")
    assertEquals(1, held.size)
  }

  @Test fun aStartThatNeverBeganFailsAMinuteOn() {
    stoppedTester()
    box.send(a, "Tester", "need you", replyTo = null, wake = true)
    courier.answers.remove("b")
    now += MessageRules.START_GIVE_UP_MS - 1
    box.refresh("b")
    assertTrue(held.isEmpty())
    now += 1
    box.refresh("b")
    assertEquals(listOf("b" to Mailbox.NEVER_CAME), held)
  }

  @Test fun aStartTheServiceTookIsNeverGivenUpWhileItWaitsItsTurn() {
    stoppedTester()
    box.send(a, "Tester", "need you", replyTo = null, wake = true)
    courier.answers.remove("b")
    box.startTaken("b")
    now += 10 * MessageRules.START_GIVE_UP_MS
    box.refresh("b")
    assertTrue(held.isEmpty())
    // The service refused it before any status: told once, held back.
    box.startFailed("b", "too_many_running: 3 agents running")
    box.engineGone("b", "too_many_running: 3 agents running")
    assertEquals(listOf("b" to "too_many_running: 3 agents running"), held)
    assertEquals(1, box.recent(5).count { it.notice && it.to == "a" })
  }

  @Test fun aStartAndroidRefusedTellsTheSenderWhy() {
    view.set("b", AgentState.STOPPED)
    view.starts["b"] = null
    val sent = box.send(a, "Tester", "need you", replyTo = null, wake = true)
    assertEquals(SendStatus.QUEUED, sent.results.single().status)
    assertTrue(sent.results.single().reason!!.contains("not started: Android did not let PhoneCanDo start it"))
    assertTrue(held.isEmpty())
  }

  @Test fun aStopOfTheUsersOrOneThatCameEndsTheStartQuietly() {
    stoppedTester()
    box.send(a, "Tester", "need you", replyTo = null, wake = true)
    box.engineGone("b")
    assertTrue(held.isEmpty())
    assertEquals(1, box.recent(5).size)
  }

  @Test fun onlyANewMessageStartsAStoppedAgentAndTheSenderHearsWhyNot() {
    view.set("b", AgentState.STOPPED)
    view.starts["b"] = null
    val quiet = box.send(a, "Tester", "fyi", replyTo = null, wake = false)
    assertTrue(quiet.results.single().reason!!.contains("send with wake: true to start it"))
    view.starts["b"] = "the phone is short of memory"
    val loud = box.send(a, "Tester", "need you", replyTo = null, wake = true)
    assertEquals(SendStatus.QUEUED, loud.results.single().status)
    assertTrue(loud.results.single().reason!!.contains("it is stopped; it gets this when it next runs (not started: the phone is short of memory)"))
    assertFalse(courier.last("b")!!.wake)
    // Room again: a chat change (a retry) still starts nothing, so an agent you just stopped stays stopped.
    view.starts["b"] = null
    box.chatsChanged(emptySet())
    assertFalse(courier.last("b")!!.wake)
  }

}
