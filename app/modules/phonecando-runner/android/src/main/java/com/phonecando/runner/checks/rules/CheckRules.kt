package com.phonecando.runner.checks.rules

import com.phonecando.agents.kit.Capability
import com.phonecando.agents.kit.EngineEvent
import com.phonecando.agents.kit.InboxCall
import com.phonecando.agents.kit.manifest.InboxWake
import com.phonecando.runner.engine.EngineMode
import com.phonecando.runner.messages.MessageRules

// When a capability reads Checked or Not working, from exact signals of an
// engine life (Life); anything else records nothing. A capability the
// life's kind does not declare is never decided.
//   tools        S1 in a terminal life. Fails GRACE_MS after a terminal turn
//                end with no S1 in the life, only when its tools come from
//                an MCP server (mcp:config, mcp:argv; a plugin never fails).
//   acpTools     S1 in an ACP life. Fails as tools after an ACP turn end,
//                when `engine.acp.tools` is session or its tools are MCP.
//   messages     S2 (not wait) for an `inbox.hooks` event, or S3, in a
//                terminal life; a server kind's S7 deliver 2xx. Fails as
//                tools when it has hooks and none reported (nor a receipt);
//                a server kind's S7 deliver 4xx/5xx; a reader kind never.
//   acpMessages  The same in an ACP life, after an ACP turn end.
//   wake         hook: S2 wait, else fails as tools after a terminal turn
//                end. reader: S3 for the last wake-marked set; fails when a
//                set written while its terminal engine was up got none in
//                WAKE_RECEIPT_MS and is still pending. server: S7 wake.
//   task         A terminal life launched with a task: a WORKING event or
//                S5 within TASK_WINDOW_MS. Fails when the life exits on its
//                own inside that window (exit 0 quit_ok, else quit_error),
//                unless someone typed in it; a relaunch is a life of its own.
//   state        S6 at the life's first turn end; else fails at its grace.
//   acp          ACP mode opened its chat; fails on onAcpFailed.
//   chat         A terminal life launched on ACP's chat: its first activity
//                event, or up CHAT_HOLD_MS after READY. Fails when
//                ResumeFallback launches it again without that chat.
// A turn end is a terminal FINISHED event or an ACP end_turn. A failure at
// grace needs the life still up then. Pure: the clock is injected.
internal class CheckRules(private val clock: () -> Long) {
  /** A life launched now. */
  fun launch(agentId: String, facts: KindFacts, mode: EngineMode, prompt: String?, chat: Boolean) =
    Life(agentId, facts, mode, prompt, chat, clock())

  // ---- what shows a capability working ------------------------------------------

  /** S1: a bridge request with its token. */
  fun contact(life: Life): List<Verdict> {
    life.contact = true
    return okIf(life, if (life.mode == EngineMode.ACP) Capability.ACP_TOOLS else Capability.TOOLS)
  }

  /** S2: an inbox hook reported it ran; [wait]: the waiting one, before it waits. */
  fun hook(life: Life, event: String, wait: Boolean): List<Verdict> {
    if (wait) {
      life.waited = true
      return if (life.facts.wake == InboxWake.HOOK) okIf(life, Capability.WAKE) else emptyList()
    }
    if (event !in life.facts.hookEvents) return emptyList()
    life.hooks += event
    return messagesOk(life)
  }

  /** S3: its hook or reader handed it these message ids. */
  fun receipt(life: Life, ids: List<Long>): List<Verdict> {
    life.receipt = true
    val out = ArrayList(messagesOk(life))
    val set = life.wakeSet
    if (set != null && ids.any { it in set }) {
      life.wakeSet = null
      if (life.facts.wake == InboxWake.READER) out += okIf(life, Capability.WAKE)
    }
    return out
  }

  /** S7: a server kind's server answered a deliver or wake call with [status]. */
  fun served(life: Life, call: InboxCall, status: Int): List<Verdict> {
    if (!life.facts.server) return emptyList()
    val capability = when (call) {
      InboxCall.DELIVER -> Capability.MESSAGES
      InboxCall.WAKE -> if (life.facts.wake == InboxWake.SERVER) Capability.WAKE else return emptyList()
    }
    if (capability !in life.facts.declared) return emptyList()
    return when (status) {
      in 200..299 -> listOf(Verdict.ok(capability))
      in 400..599 -> listOf(Verdict.failed(capability, CheckCopy.http(status), CheckCopy.httpDetail(call, status)))
      else -> emptyList()
    }
  }

  /** An engine event of a terminal life (ACP's turns come by acp*); [activity]: anything but OTHER, or a new session. */
  fun event(life: Life, kind: EngineEvent.Kind, activity: Boolean): List<Verdict> {
    if (life.mode != EngineMode.TERMINAL) return emptyList()
    val out = ArrayList<Verdict>()
    if (activity && !life.activity) {
      life.activity = true
      if (life.chat) out += okIf(life, Capability.CHAT)
    }
    if (kind == EngineEvent.Kind.WORKING) out += taskSeen(life)
    return out
  }

  /** S5: its screen now, stripped and compacted (ScreenText). */
  fun screen(life: Life, compacted: String): List<Verdict> {
    val needle = life.needle ?: return emptyList()
    return if (needle in compacted) taskSeen(life) else emptyList()
  }

  /** Watched for its task: a terminal life launched with one, of a kind that starts with one. */
  fun watchesTask(life: Life) = life.mode == EngineMode.TERMINAL && life.prompt != null && Capability.TASK in life.facts.declared

  /** Its screen is still worth a look (S5): watched for its task, not seen yet, up, inside the window. */
  fun looksAtScreen(life: Life) = watchesTask(life) && !life.taskSeen && life.up && inTaskWindow(life)

  fun ready(life: Life) {
    life.ready = true
  }

  /** Watched for its chat: a terminal life launched on the chat ACP mode left. */
  fun watchesChat(life: Life) = life.mode == EngineMode.TERMINAL && life.chat && Capability.CHAT in life.facts.declared

  /** CHAT_HOLD_MS after READY: still up on that chat. */
  fun chatHeld(life: Life): List<Verdict> =
    if (watchesChat(life) && life.up && life.ready) listOf(Verdict.ok(Capability.CHAT)) else emptyList()

  /** ACP mode opened its chat (new, loaded or resumed). */
  fun acpOpened(life: Life): List<Verdict> = if (life.mode == EngineMode.ACP) okIf(life, Capability.ACP) else emptyList()

  // ---- turn ends ------------------------------------------------------------------

  /**
   * A turn ended (a terminal FINISHED, an ACP end_turn). At the life's
   * first, [wrote] is S6 (null: not looked at, as it keeps no state of its
   * own). What shows now; afterGrace decides the rest.
   */
  fun turnEnded(life: Life, wrote: Boolean?): List<Verdict> {
    life.turnEnds++
    return if (life.turnEnds == 1 && wrote == true) okIf(life, Capability.STATE) else emptyList()
  }

  /**
   * GRACE_MS after a turn end: what the life still lacks fails, while it
   * is up (one that ended meanwhile decides nothing). [first]: that turn was
   * its first, with [wrote] S6 now (null: not looked at).
   */
  fun afterGrace(life: Life, first: Boolean, wrote: Boolean?): List<Verdict> {
    if (!life.up) return emptyList()
    val f = life.facts
    val acp = life.mode == EngineMode.ACP
    val out = ArrayList<Verdict>()
    val tools = if (acp) Capability.ACP_TOOLS else Capability.TOOLS
    val reaches = if (acp) f.acpToolsExpected else f.toolsByMcp
    if (tools in f.declared && reaches && !life.contact) {
      out += Verdict.failed(tools, CheckCopy.NO_CONTACT, CheckCopy.noContact(acp))
    }
    val messages = if (acp) Capability.ACP_MESSAGES else Capability.MESSAGES
    if (messages in f.declared && f.hookEvents.isNotEmpty() && life.hooks.isEmpty() && !life.receipt) {
      out += Verdict.failed(messages, CheckCopy.NO_HOOK, CheckCopy.noHook(f.hookEvents, acp))
    }
    if (!acp && Capability.WAKE in f.declared && f.wake == InboxWake.HOOK && !life.waited) {
      out += Verdict.failed(Capability.WAKE, CheckCopy.NO_WAITER, CheckCopy.NO_WAITER_DETAIL)
    }
    if (first && wrote != null && Capability.STATE in f.declared) {
      out += if (wrote) Verdict.ok(Capability.STATE) else Verdict.failed(Capability.STATE, CheckCopy.EMPTY_STATE, CheckCopy.EMPTY_STATE_DETAIL)
    }
    return out
  }

  // ---- ends ---------------------------------------------------------------------------

  /** It exited on its own with [code]; [lines]: its screen's last lines; [typed]: someone typed in it this life, so the quit may be theirs. */
  fun exited(life: Life, code: Int, lines: String?, typed: Boolean): List<Verdict> {
    life.up = false
    if (!watchesTask(life) || typed || !inTaskWindow(life)) return emptyList()
    val verdict = if (code == 0) {
      Verdict.failed(Capability.TASK, CheckCopy.QUIT_OK, CheckCopy.QUIT_OK_DETAIL)
    } else {
      Verdict.failed(Capability.TASK, CheckCopy.QUIT_ERROR, CheckCopy.quitError(code, lines))
    }
    return listOf(verdict)
  }

  /** ResumeFallback launches it again, without its resume args or chat, after it exited with [code]; a new life follows. */
  fun relaunched(life: Life, code: Int): List<Verdict> {
    life.up = false
    return if (watchesChat(life)) listOf(Verdict.failed(Capability.CHAT, CheckCopy.CHAT_REFUSED, CheckCopy.chatRefused(code))) else emptyList()
  }

  /** ACP mode could not open its chat (the supervisor's onAcpFailed). */
  fun acpFailed(life: Life, reason: String): List<Verdict> =
    if (life.mode == EngineMode.ACP && Capability.ACP in life.facts.declared) {
      listOf(Verdict.failed(Capability.ACP, CheckCopy.ACP_FAILED, CheckCopy.acpFailed(reason)))
    } else {
      emptyList()
    }

  /** Stopped, by us or a failed start: it decides nothing more. */
  fun ended(life: Life) {
    life.up = false
  }

  // ---- a reader's wake --------------------------------------------------------------

  /**
   * A wake-marked set [ids] left in its folder: kept when its kind wakes by
   * its reader and its terminal engine is up. True when the watcher should
   * ask wakeUnanswered in WAKE_RECEIPT_MS; the same set again keeps its time.
   */
  fun wakeSetWritten(life: Life, ids: List<Long>): Boolean {
    if (!life.up || life.mode != EngineMode.TERMINAL || life.facts.wake != InboxWake.READER) return false
    if (Capability.WAKE !in life.facts.declared || ids.isEmpty() || life.wakeSet == ids) return false
    life.wakeSet = ids
    return true
  }

  /** WAKE_RECEIPT_MS after [ids] were written: still unanswered while up, and [pending] (its folder's ids now) still holds them. */
  fun wakeUnanswered(life: Life, ids: List<Long>, pending: Set<Long>): List<Verdict> {
    if (!life.up || life.wakeSet != ids || ids.none { it in pending }) return emptyList()
    return listOf(Verdict.failed(Capability.WAKE, CheckCopy.NO_RECEIPT, CheckCopy.NO_RECEIPT_DETAIL))
  }

  private fun taskSeen(life: Life): List<Verdict> {
    if (!watchesTask(life) || life.taskSeen || !inTaskWindow(life)) return emptyList()
    life.taskSeen = true
    return listOf(Verdict.ok(Capability.TASK))
  }

  private fun inTaskWindow(life: Life) = clock() - life.launchedAt <= TASK_WINDOW_MS

  private fun messagesOk(life: Life) = okIf(life, if (life.mode == EngineMode.ACP) Capability.ACP_MESSAGES else Capability.MESSAGES)

  private fun okIf(life: Life, capability: Capability): List<Verdict> =
    if (capability in life.facts.declared) listOf(Verdict.ok(capability)) else emptyList()

  companion object {
    /** After a turn end, what it lacks may still come (a hook's line, a late tool call). */
    const val GRACE_MS = 10_000L

    /** From the launch, a task shows or its quit counts. */
    const val TASK_WINDOW_MS = 120_000L

    /** A reader has this long to answer a set that may wake it. */
    const val WAKE_RECEIPT_MS = MessageRules.WAKE_START_MS

    /** Up this long after READY on ACP's chat: it took the chat. */
    const val CHAT_HOLD_MS = 30_000L

    /** S5 looks at the screen this often inside the task window. */
    const val SCREEN_POLL_MS = 2_000L

    /** Of a TUI's screen ring, what S5 and the quit's last lines read. */
    const val SCREEN_BYTES = 64 * 1024

    /** The stopReason of an ACP turn that ended well. */
    const val END_TURN = "end_turn"
  }
}
