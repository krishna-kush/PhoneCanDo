package com.phonecando.runner.checks.rules

import com.phonecando.agents.kit.Capability
import com.phonecando.agents.kit.EngineEvent
import com.phonecando.agents.kit.InboxCall
import com.phonecando.agents.kit.manifest.InboxWake
import com.phonecando.runner.engine.EngineMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// Each capability's rule: the signal that checks it, the one that fails
// it, and the cases that record nothing (an undeclared capability, a life
// that ended before its grace, a stop or a quit outside the task window).
class CheckRulesTest {
  private var now = 1_000_000L
  private val rules = CheckRules { now }

  // A hooks kind with everything: tools by MCP, hooks, a waiting hook, ACP.
  private val hooks = KindFacts(
    declared = Capability.values().toSet(),
    toolsByMcp = true,
    acpToolsExpected = true,
    hookEvents = listOf("UserPromptSubmit", "Stop"),
    wake = InboxWake.HOOK,
  )

  // A plugin kind whose own reader takes its messages and wakes it.
  private val reader = KindFacts(declared = setOf(Capability.TOOLS, Capability.MESSAGES, Capability.WAKE), wake = InboxWake.READER)

  // A server kind whose server takes and wakes.
  private val server = KindFacts(declared = setOf(Capability.TOOLS, Capability.MESSAGES, Capability.WAKE), server = true, wake = InboxWake.SERVER)

  private fun life(facts: KindFacts = hooks, mode: EngineMode = EngineMode.TERMINAL, prompt: String? = null, chat: Boolean = false) =
    rules.launch("a", facts, mode, prompt, chat)

  private fun ok(capability: Capability) = listOf(Verdict.ok(capability))

  private fun List<Verdict>.of(capability: Capability) = filter { it.capability == capability }

  // A turn ended, then its grace passed.
  private fun turnAndGrace(life: Life, wrote: Boolean? = null): List<Verdict> {
    val first = life.turnEnds == 0
    rules.turnEnded(life, wrote)
    now += CheckRules.GRACE_MS
    return rules.afterGrace(life, first, wrote)
  }

  // ---- tools, acpTools -----------------------------------------------------------

  @Test fun aBridgeCallChecksTheToolsOfItsMode() {
    assertEquals(ok(Capability.TOOLS), rules.contact(life()))
    assertEquals(ok(Capability.ACP_TOOLS), rules.contact(life(mode = EngineMode.ACP)))
    assertEquals(emptyList<Verdict>(), rules.contact(life(KindFacts(declared = emptySet()))))
  }

  @Test fun mcpToolsFailAfterATurnWithoutContact() {
    val failed = turnAndGrace(life()).of(Capability.TOOLS)
    assertEquals(listOf(Verdict.failed(Capability.TOOLS, CheckCopy.NO_CONTACT, CheckCopy.noContact(acp = false))), failed)
    val reached = life().also { rules.contact(it) }
    assertEquals(emptyList<Verdict>(), turnAndGrace(reached).of(Capability.TOOLS))
  }

  @Test fun pluginToolsNeverFail() {
    val plugin = hooks.copy(toolsByMcp = false, acpToolsExpected = false)
    assertEquals(emptyList<Verdict>(), turnAndGrace(life(plugin)).of(Capability.TOOLS))
    assertEquals(emptyList<Verdict>(), turnAndGrace(life(plugin, EngineMode.ACP)).of(Capability.ACP_TOOLS))
  }

  @Test fun acpToolsFailAfterAnAcpTurnWithoutContact() {
    val failed = turnAndGrace(life(mode = EngineMode.ACP))
    assertEquals(listOf(Verdict.failed(Capability.ACP_TOOLS, CheckCopy.NO_CONTACT, CheckCopy.noContact(acp = true))), failed.of(Capability.ACP_TOOLS))
    assertTrue(CheckCopy.noContact(acp = true).contains("in ACP mode"))
    // A terminal capability is never failed by an ACP turn.
    assertEquals(emptyList<Verdict>(), failed.of(Capability.TOOLS))
  }

  @Test fun aLifeThatEndedBeforeItsGraceDecidesNothing() {
    val life = life()
    rules.turnEnded(life, null)
    rules.ended(life)
    now += CheckRules.GRACE_MS
    assertEquals(emptyList<Verdict>(), rules.afterGrace(life, first = true, wrote = false))
    val exited = life(prompt = "fix the tests")
    rules.turnEnded(exited, null)
    rules.exited(exited, code = 1, lines = null, typed = false)
    assertEquals(emptyList<Verdict>(), rules.afterGrace(exited, first = true, wrote = null).of(Capability.TOOLS))
  }

  // ---- messages, acpMessages --------------------------------------------------------

  @Test fun anInboxHookOrAReceiptChecksMessages() {
    assertEquals(ok(Capability.MESSAGES), rules.hook(life(), "Stop", wait = false))
    assertEquals(emptyList<Verdict>(), rules.hook(life(), "SessionStart", wait = false))
    assertEquals(ok(Capability.MESSAGES), rules.receipt(life(), listOf(4L)))
    assertEquals(ok(Capability.ACP_MESSAGES), rules.hook(life(mode = EngineMode.ACP), "UserPromptSubmit", wait = false))
    assertEquals(ok(Capability.ACP_MESSAGES), rules.receipt(life(mode = EngineMode.ACP), listOf(4L)))
  }

  @Test fun hooksThatNeverRanFailMessagesAfterATurn() {
    val failed = turnAndGrace(life()).of(Capability.MESSAGES)
    assertEquals(
      listOf(Verdict.failed(Capability.MESSAGES, CheckCopy.NO_HOOK, CheckCopy.noHook(listOf("UserPromptSubmit", "Stop"), acp = false))),
      failed,
    )
    assertTrue(failed.single().detail!!.contains("(UserPromptSubmit, Stop)"))
    val ran = life().also { rules.hook(it, "UserPromptSubmit", wait = false) }
    assertEquals(emptyList<Verdict>(), turnAndGrace(ran).of(Capability.MESSAGES))
    val read = life().also { rules.receipt(it, listOf(9L)) }
    assertEquals(emptyList<Verdict>(), turnAndGrace(read).of(Capability.MESSAGES))
    // An event the inbox does not name, or the waiting form, is no message hook.
    val other = life().also {
      rules.hook(it, "SessionStart", wait = false)
      rules.hook(it, "Stop", wait = true)
    }
    assertEquals(1, turnAndGrace(other).of(Capability.MESSAGES).size)
  }

  @Test fun acpMessagesFailAfterAnAcpTurnWithoutHooks() {
    val failed = turnAndGrace(life(mode = EngineMode.ACP))
    assertEquals(
      listOf(Verdict.failed(Capability.ACP_MESSAGES, CheckCopy.NO_HOOK, CheckCopy.noHook(hooks.hookEvents, acp = true))),
      failed.of(Capability.ACP_MESSAGES),
    )
    assertEquals(emptyList<Verdict>(), failed.of(Capability.MESSAGES))
  }

  @Test fun aReaderKindsMessagesNeverFail() {
    assertEquals(emptyList<Verdict>(), turnAndGrace(life(reader)))
  }

  // ---- wake -----------------------------------------------------------------------------

  @Test fun theWaitingHookChecksWakeAndItsAbsenceFailsIt() {
    assertEquals(ok(Capability.WAKE), rules.hook(life(), "Stop", wait = true))
    assertEquals(
      listOf(Verdict.failed(Capability.WAKE, CheckCopy.NO_WAITER, CheckCopy.NO_WAITER_DETAIL)),
      turnAndGrace(life()).of(Capability.WAKE),
    )
    val waited = life().also { rules.hook(it, "Stop", wait = true) }
    assertEquals(emptyList<Verdict>(), turnAndGrace(waited).of(Capability.WAKE))
    // Only a terminal turn fails it.
    assertEquals(emptyList<Verdict>(), turnAndGrace(life(mode = EngineMode.ACP)).of(Capability.WAKE))
    // A waiting hook of a kind that does not wake by hook checks nothing.
    assertEquals(emptyList<Verdict>(), rules.hook(life(reader), "Stop", wait = true))
  }

  @Test fun aReaderWakeIsCheckedByTheReceiptOfItsSet() {
    val life = life(reader)
    assertTrue(rules.wakeSetWritten(life, listOf(3L, 4L)))
    // The same set again keeps its time.
    assertFalse(rules.wakeSetWritten(life, listOf(3L, 4L)))
    assertEquals(ok(Capability.MESSAGES) + ok(Capability.WAKE), rules.receipt(life, listOf(4L)))
    // Answered: nothing fails later.
    assertEquals(emptyList<Verdict>(), rules.wakeUnanswered(life, listOf(3L, 4L), setOf(3L, 4L)))
    // A receipt for other messages is no answer to the set.
    assertTrue(rules.wakeSetWritten(life, listOf(7L)))
    assertEquals(ok(Capability.MESSAGES), rules.receipt(life, listOf(5L)))
  }

  @Test fun aReaderWakeSetLeftUnansweredFailsWake() {
    val life = life(reader)
    rules.wakeSetWritten(life, listOf(3L, 4L))
    assertEquals(
      listOf(Verdict.failed(Capability.WAKE, CheckCopy.NO_RECEIPT, CheckCopy.NO_RECEIPT_DETAIL)),
      rules.wakeUnanswered(life, listOf(3L, 4L), setOf(4L, 5L)),
    )
    // No longer pending (read through agents_inbox, say): nothing.
    assertEquals(emptyList<Verdict>(), rules.wakeUnanswered(life, listOf(3L, 4L), setOf(5L)))
    // A newer set took its place: the older one decides nothing.
    rules.wakeSetWritten(life, listOf(3L, 4L, 5L))
    assertEquals(emptyList<Verdict>(), rules.wakeUnanswered(life, listOf(3L, 4L), setOf(3L, 4L, 5L)))
    // Its engine stopped meanwhile: nothing.
    rules.ended(life)
    assertEquals(emptyList<Verdict>(), rules.wakeUnanswered(life, listOf(3L, 4L, 5L), setOf(3L, 4L, 5L)))
  }

  @Test fun aWakeSetCountsOnlyWhileATerminalEngineOfAReaderKindIsUp() {
    assertFalse(rules.wakeSetWritten(life(reader, EngineMode.ACP), listOf(1L)))
    assertFalse(rules.wakeSetWritten(life(hooks), listOf(1L)))
    assertFalse(rules.wakeSetWritten(life(reader).also(rules::ended), listOf(1L)))
    assertFalse(rules.wakeSetWritten(life(reader.copy(declared = setOf(Capability.MESSAGES))), listOf(1L)))
  }

  // ---- a server kind (S7) ------------------------------------------------------------------

  @Test fun aServersAnswersCheckOrFailMessagesAndWake() {
    val life = life(server)
    assertEquals(ok(Capability.MESSAGES), rules.served(life, InboxCall.DELIVER, 200))
    assertEquals(
      listOf(Verdict.failed(Capability.MESSAGES, "http_503", CheckCopy.httpDetail(InboxCall.DELIVER, 503))),
      rules.served(life, InboxCall.DELIVER, 503),
    )
    assertEquals(ok(Capability.WAKE), rules.served(life, InboxCall.WAKE, 204))
    assertEquals(
      listOf(Verdict.failed(Capability.WAKE, "http_404", CheckCopy.httpDetail(InboxCall.WAKE, 404))),
      rules.served(life, InboxCall.WAKE, 404),
    )
    // Not an answer that says either way.
    assertEquals(emptyList<Verdict>(), rules.served(life, InboxCall.DELIVER, 302))
    // Not a server kind, or one that does not wake by its server.
    assertEquals(emptyList<Verdict>(), rules.served(life(hooks), InboxCall.DELIVER, 500))
    assertEquals(emptyList<Verdict>(), rules.served(life(server.copy(wake = null)), InboxCall.WAKE, 500))
    // A server kind never fails at a turn's grace.
    assertEquals(emptyList<Verdict>(), turnAndGrace(life(server)))
  }

  // ---- task -----------------------------------------------------------------------------------

  @Test fun aWorkingEventOrTheTaskOnScreenChecksTheTask() {
    val working = life(prompt = "fix the tests")
    assertTrue(rules.watchesTask(working))
    assertEquals(ok(Capability.TASK), rules.event(working, EngineEvent.Kind.WORKING, activity = true))
    assertEquals(emptyList<Verdict>(), rules.event(working, EngineEvent.Kind.WORKING, activity = true))
    assertFalse(rules.looksAtScreen(working))

    val shown = life(prompt = "Scheduled task from the user (daily 09:00): tidy the inbox")
    assertTrue(rules.looksAtScreen(shown))
    assertEquals(emptyList<Verdict>(), rules.screen(shown, ScreenText.compact("Welcome back!")))
    assertEquals(ok(Capability.TASK), rules.screen(shown, ScreenText.compact("> Scheduled task from\n  the user (daily")))
  }

  @Test fun theTaskIsNotCheckedOutsideItsWindowOrWithoutOne() {
    val late = life(prompt = "fix the tests")
    now += CheckRules.TASK_WINDOW_MS + 1
    assertFalse(rules.looksAtScreen(late))
    assertEquals(emptyList<Verdict>(), rules.event(late, EngineEvent.Kind.WORKING, activity = true))
    assertFalse(rules.watchesTask(life()))
    assertEquals(emptyList<Verdict>(), rules.event(life(), EngineEvent.Kind.WORKING, activity = true))
    assertFalse(rules.watchesTask(life(mode = EngineMode.ACP, prompt = "fix the tests")))
    assertFalse(rules.watchesTask(life(reader, prompt = "fix the tests")))
  }

  @Test fun aQuitInsideTheWindowFailsTheTask() {
    assertEquals(
      listOf(Verdict.failed(Capability.TASK, CheckCopy.QUIT_OK, CheckCopy.QUIT_OK_DETAIL)),
      rules.exited(life(prompt = "fix the tests"), code = 0, lines = null, typed = false),
    )
    // Even after it showed working: it ran the task, then quit.
    val ran = life(prompt = "fix the tests").also { rules.event(it, EngineEvent.Kind.WORKING, activity = true) }
    assertEquals(CheckCopy.QUIT_OK, rules.exited(ran, code = 0, lines = null, typed = false).single().code)
    val error = rules.exited(life(prompt = "fix the tests"), code = 2, lines = "Error: no API key", typed = false).single()
    assertEquals(CheckCopy.QUIT_ERROR, error.code)
    assertEquals("It quit with exit 2 right after starting with the task. Its last lines: Error: no API key", error.detail)
  }

  @Test fun aQuitOutsideTheWindowAfterTypingOrWithoutATaskRecordsNothing() {
    val late = life(prompt = "fix the tests")
    now += CheckRules.TASK_WINDOW_MS + 1
    assertEquals(emptyList<Verdict>(), rules.exited(late, code = 1, lines = null, typed = false))
    assertEquals(emptyList<Verdict>(), rules.exited(life(prompt = "fix the tests"), code = 0, lines = null, typed = true))
    assertEquals(emptyList<Verdict>(), rules.exited(life(), code = 1, lines = null, typed = false))
    // A relaunch is judged as its own life: this one records nothing for its task.
    assertEquals(emptyList<Verdict>(), rules.relaunched(life(prompt = "fix the tests"), code = 1))
  }

  // ---- state -------------------------------------------------------------------------------------

  @Test fun theStateFolderIsCheckedAtTheFirstTurnEnd() {
    assertEquals(ok(Capability.STATE), rules.turnEnded(life(), wrote = true))
    val empty = life()
    assertEquals(emptyList<Verdict>(), rules.turnEnded(empty, wrote = false))
    now += CheckRules.GRACE_MS
    assertEquals(
      listOf(Verdict.failed(Capability.STATE, CheckCopy.EMPTY_STATE, CheckCopy.EMPTY_STATE_DETAIL)),
      rules.afterGrace(empty, first = true, wrote = false).of(Capability.STATE),
    )
    // It wrote during the grace.
    assertEquals(ok(Capability.STATE), rules.afterGrace(empty, first = true, wrote = true).of(Capability.STATE))
    // Only the first turn end of a life, and only an agent that keeps its own state.
    assertEquals(emptyList<Verdict>(), rules.afterGrace(empty, first = false, wrote = false).of(Capability.STATE))
    val shared = life(hooks.copy(declared = hooks.declared - Capability.STATE))
    assertEquals(emptyList<Verdict>(), rules.turnEnded(shared, wrote = true))
    assertEquals(emptyList<Verdict>(), turnAndGrace(shared, wrote = false).of(Capability.STATE))
    // An ACP turn counts too.
    assertEquals(ok(Capability.STATE), rules.turnEnded(life(mode = EngineMode.ACP), wrote = true))
  }

  // ---- acp ----------------------------------------------------------------------------------------

  @Test fun acpModeIsCheckedWhenItOpensItsChatAndFailsWithWhy() {
    assertEquals(ok(Capability.ACP), rules.acpOpened(life(mode = EngineMode.ACP)))
    assertEquals(emptyList<Verdict>(), rules.acpOpened(life()))
    assertEquals(
      listOf(Verdict.failed(Capability.ACP, CheckCopy.ACP_FAILED, "Sign in first.")),
      rules.acpFailed(life(mode = EngineMode.ACP), "  Sign in first.\n"),
    )
    assertEquals(CheckCopy.QUOTE_MAX, rules.acpFailed(life(mode = EngineMode.ACP), "x".repeat(500)).single().detail!!.length)
    assertEquals(emptyList<Verdict>(), rules.acpFailed(life(reader, EngineMode.ACP), "no ACP"))
  }

  // ---- chat ----------------------------------------------------------------------------------------

  @Test fun aLaunchOnTheAcpChatIsCheckedByItsFirstEventOrByStayingUp() {
    val evented = life(chat = true)
    assertTrue(rules.watchesChat(evented))
    assertEquals(ok(Capability.CHAT), rules.event(evented, EngineEvent.Kind.OTHER, activity = true))
    assertEquals(emptyList<Verdict>(), rules.event(evented, EngineEvent.Kind.FINISHED, activity = true))

    val held = life(chat = true)
    rules.ready(held)
    assertEquals(ok(Capability.CHAT), rules.chatHeld(held))
    // Gone before the hold: nothing.
    val gone = life(chat = true).also {
      rules.ready(it)
      rules.ended(it)
    }
    assertEquals(emptyList<Verdict>(), rules.chatHeld(gone))
    // Not launched on a chat: nothing.
    assertEquals(emptyList<Verdict>(), rules.event(life(), EngineEvent.Kind.WORKING, activity = true).of(Capability.CHAT))
  }

  @Test fun aRelaunchWithoutTheChatFailsIt() {
    assertEquals(
      listOf(Verdict.failed(Capability.CHAT, CheckCopy.CHAT_REFUSED, CheckCopy.chatRefused(1))),
      rules.relaunched(life(chat = true), code = 1),
    )
    assertTrue(CheckCopy.chatRefused(1).startsWith("It quit with exit 1 "))
    assertEquals(emptyList<Verdict>(), rules.relaunched(life(), code = 1))
  }
}
