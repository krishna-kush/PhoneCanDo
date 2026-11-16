package com.phonecando.runner.checks.now

import com.phonecando.runner.checks.TurnEnd
import com.phonecando.runner.engine.EngineMode
import com.phonecando.runner.engine.acp.AcpOption

// What Check now may do with an agent, and how: refused (first match) when
// its kind can't start with a task (neither `engine.prompt` nor
// `engine.acp`), a check already runs for it, its machine is installing or
// setting up, it isn't installed yet, or its run is going (working or
// waiting). Its parts (plan), each with the capabilities it tests (declared
// ones only, by wire id):
// - a kind with `engine.acp`: part 1 in ACP mode with the task in a new
//   chat (acp, acpTools, acpMessages, and state when the agent keeps its
//   own); then, when it has `engine.prompt` or `engine.acp.chat`, part 2 in
//   its own app (terminal mode) on the chat part 1 used (tools, messages,
//   wake, task, chat). With `engine.prompt` the task goes again; without,
//   part 2 has no task: messages and wake are skipped (they need a turn),
//   tools and chat still test. A kind that takes a prompt but can't open
//   that chat runs part 2 in a new chat, so the task never lands in your
//   last one.
// - any other kind: one part in terminal mode, the task in a new chat
//   (tools, messages, wake, task, state).
// Check the rest leaves out what is checked already (done): a part with
// nothing left drops, except the ACP part when part 2 still tests chat (it
// then only opens that chat, holdsChat); part 2 without an ACP part before it
// always takes a new chat.
// The task asks for no tools: tools are checked by their start-up
// connection. While a check runs, an ACP permission question is answered
// with a reject (rejectOption). A stop someone asked for ends the whole
// check, its later parts never sent (turnEndStopsCheck, engineEndStopsCheck).
// Once it is over, an agent that ran in its
// own app before it starts again there (restartAfter), unless someone
// stopped it during the check (stoppedDuring: you, or the memory guard).
// Pure.
object CheckNowRules {
  /** What we know of the agent when you ask. */
  data class Look(
    /** Its kind starts with a first prompt (`engine.prompt`). */
    val prompts: Boolean,
    /** Its kind has an ACP mode (`engine.acp`). */
    val acp: Boolean,
    /** A check runs for it now. */
    val checking: Boolean,
    /** A Linux job runs on its machine (an install or a setup). */
    val installing: Boolean,
    /** Its kind installs into its machine and that install isn't recorded yet. */
    val notInstalled: Boolean,
    /** A run of it is going: working, or waiting for you. */
    val busy: Boolean,
  )

  const val NO_AGENT = "There's no such agent."
  const val NO_KIND = "Its kind isn't in this build."
  const val CANT = "It can't start with a task, so only real use checks it."
  const val CHECKING = "A check is already running for it."
  const val INSTALLING = "Its machine is installing or setting up. Try again when that's done."
  const val NOT_INSTALLED = "It isn't installed yet."
  const val BUSY = "It's busy with a run. Try again when it's idle."
  const val NOTHING_LEFT = "Everything is checked. Check all again to run every check."
  const val CANT_LEFT = "What's left needs a turn in its own app, so it's checked the first time you use it."

  /** The check task, every part and every kind. */
  const val TASK = "PhoneCanDo check: reply with just the word done. Don't use any tools."

  // Capability wire ids (kit Capability), in its order.
  const val TOOLS = "tools"
  const val MESSAGES = "messages"
  const val WAKE = "wake"
  const val TASK_ROW = "task"
  const val STATE = "state"
  const val ACP = "acp"
  const val ACP_TOOLS = "acpTools"
  const val ACP_MESSAGES = "acpMessages"
  const val CHAT = "chat"

  /** Why its kind can't take Check now at all; null when it can. */
  fun kindRefusal(prompts: Boolean, acp: Boolean): String? = if (prompts || acp) null else CANT

  /** Why not now; null when it may start. */
  fun refusal(look: Look): String? = kindRefusal(look.prompts, look.acp) ?: when {
    look.checking -> CHECKING
    look.installing -> INSTALLING
    look.notInstalled -> NOT_INSTALLED
    look.busy -> BUSY
    else -> null
  }

  /**
   * The parts for a kind that [prompts] (`engine.prompt`), has an [acp]
   * mode and [opensChat] (`engine.acp.chat`), testing only the [declared]
   * capabilities (wire ids; `state` only when the agent keeps its own)
   * less those [done] (checked already: Check the rest); null when it
   * can't take Check now, or nothing it can test is left.
   */
  fun plan(prompts: Boolean, acp: Boolean, opensChat: Boolean, declared: Set<String>, done: Set<String> = emptySet()): CheckPlan? {
    fun only(vararg ids: String) = ids.filter { it in declared && it !in done }
    if (!acp) {
      if (!prompts) return null
      val tests = only(TOOLS, MESSAGES, WAKE, TASK_ROW, STATE)
      return if (tests.isEmpty()) null else CheckPlan(listOf(CheckPlan.Part(EngineMode.TERMINAL, TASK, newChat = true, tests = tests)))
    }
    val inAcpTests = only(STATE, ACP, ACP_TOOLS, ACP_MESSAGES)
    val appTests = when {
      prompts -> only(TOOLS, MESSAGES, WAKE, TASK_ROW, CHAT)
      opensChat -> only(TOOLS, CHAT)
      else -> emptyList()
    }
    val holdsChat = CHAT in appTests
    val inAcp = if (inAcpTests.isEmpty() && !holdsChat) null else CheckPlan.Part(EngineMode.ACP, TASK, newChat = true, tests = inAcpTests, holdsChat = holdsChat)
    // On the chat part 1 used; with no part 1, a new one (never your last chat).
    val onItsChat = opensChat && inAcp != null
    val inApp = when {
      appTests.isEmpty() -> null
      prompts -> CheckPlan.Part(EngineMode.TERMINAL, TASK, newChat = !onItsChat, tests = appTests)
      else -> CheckPlan.Part(EngineMode.TERMINAL, null, newChat = false, tests = appTests, skips = only(MESSAGES, WAKE))
    }
    val parts = listOfNotNull(inAcp, inApp)
    return if (parts.isEmpty()) null else CheckPlan(parts)
  }

  /** How many parts Check now runs for such a kind; 0 when it can't. */
  fun parts(prompts: Boolean, acp: Boolean, opensChat: Boolean): Int =
    plan(prompts, acp, opensChat, ALL)?.parts?.size ?: 0

  private val ALL = setOf(TOOLS, MESSAGES, WAKE, TASK_ROW, STATE, ACP, ACP_TOOLS, ACP_MESSAGES, CHAT)

  /**
   * After a check's engine is released, whether the agent starts again on
   * its own model (its own app): not when its engine still runs ([liveNow])
   * or someone stopped it during the check ([stopped], stoppedDuring: a
   * start now would go against that stop); else yes when its engine was on
   * the check model ([standIn]) with its terminal on your screen
   * ([viewer]), or when it ran in its own app before the check ([before],
   * the mode it ran in then; null: it did not run). An engine left from an
   * ACP run is not started again: idle, it would stop soon anyway.
   */
  fun restartAfter(standIn: Boolean, viewer: Boolean, liveNow: Boolean, before: EngineMode?, stopped: Boolean = false): Boolean =
    !liveNow && !stopped && ((standIn && viewer) || before == EngineMode.TERMINAL)

  /**
   * Whether someone stopped the agent during its check (begun at
   * [beganAt]): its engine ended the check with no failure ([endedByStop]:
   * your Stop, or the memory guard's), or the memory guard stopped it since
   * the check began ([memoryStopAt], MemoryStops; null: never), which may
   * come after its turn ended, when an engine end no longer ends the check.
   */
  fun stoppedDuring(endedByStop: Boolean, memoryStopAt: Long?, beganAt: Long?): Boolean =
    endedByStop || (memoryStopAt != null && beganAt != null && memoryStopAt >= beganAt)

  /**
   * Whether a part's own turn ending as [end] ends the whole check: a turn
   * someone stopped (your Stop on Home cancels its ACP turn: stop reason
   * "cancelled"; an interrupt its own app reports) does, so no later part
   * sends its task. Our own cancels come only once a part is over, so they
   * are never a part's turn end. A finished or failed turn lets its part
   * end as usual.
   */
  fun turnEndStopsCheck(end: TurnEnd): Boolean = end == TurnEnd.STOPPED

  /**
   * Whether the part's engine ending ends the whole check: before its turn
   * ended ([turnEnd] null) always; after, only a stop someone asked for
   * (not [failed]: your Stop in the notification, the memory guard) that
   * cut a turn short (its turn failed as the engine went), as a stop of an
   * engine in ACP mode ends its turn first.
   */
  fun engineEndStopsCheck(turnEnd: TurnEnd?, failed: Boolean): Boolean =
    turnEnd == null || (!failed && turnEnd != TurnEnd.FINISHED)

  /** The answer to a permission question during a check: reject once, else reject always; null: cancel it. */
  fun rejectOption(options: List<AcpOption>): String? =
    (options.firstOrNull { it.kind == REJECT_ONCE } ?: options.firstOrNull { it.kind == REJECT_ALWAYS })?.optionId

  private const val REJECT_ONCE = "reject_once"
  private const val REJECT_ALWAYS = "reject_always"
}
