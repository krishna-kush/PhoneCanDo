package com.phonecando.runner.checks.life

import android.util.Log
import com.phonecando.agents.kit.EngineEvent
import com.phonecando.agents.kit.InboxCall
import com.phonecando.runner.checks.LifeEvent
import com.phonecando.runner.checks.TurnEnd
import com.phonecando.runner.checks.rules.CheckRules
import com.phonecando.runner.checks.rules.ScreenText
import com.phonecando.runner.checks.rules.Verdict
import com.phonecando.runner.engine.EngineMode
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

// The engine lives the checks follow: each agent's newest, from its launch
// until it exits, stops, fails or is launched again. Every signal runs on
// one daemon thread in the order it came, with the timers the rules wait
// on (GRACE_MS after each turn end, CHAT_HOLD_MS after READY, a look at the
// screen every SCREEN_POLL_MS inside the task window, WAKE_RECEIPT_MS
// after a wake-marked set), so a life is only ever touched there. What the
// rules decide goes to [onVerdict], each finding once per life; turn ends
// and engine ends go to [onLife]. A signal for an agent with no life (one
// launched before the checks were up) decides nothing.
internal class LifeWatcher(
  private val rules: CheckRules,
  private val onVerdict: (Watched, Verdict) -> Unit,
  private val onLife: (agentId: String, LifeEvent) -> Unit,
) {
  private val thread: ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor { r ->
    Thread(r, "phonecando-checks").apply { isDaemon = true }
  }

  private val lives = HashMap<String, Watched>()

  /** A launch: a fresh life, replacing any other of the agent's. */
  fun launched(w: Watched) = post {
    lives.put(w.life.agentId, w)?.let(::close)
    if (rules.watchesTask(w.life)) {
      val poll = Runnable { guarded { lookAtScreen(w) } }
      w.poll = thread.scheduleWithFixedDelay(poll, CheckRules.SCREEN_POLL_MS, CheckRules.SCREEN_POLL_MS, TimeUnit.MILLISECONDS)
    }
  }

  fun ready(agentId: String) = on(agentId) { w ->
    rules.ready(w.life)
    if (rules.watchesChat(w.life)) later(CheckRules.CHAT_HOLD_MS) { decide(w, rules.chatHeld(w.life)) }
  }

  fun event(agentId: String, kind: EngineEvent.Kind, activity: Boolean, guessed: Boolean = false) = on(agentId) { w ->
    decide(w, rules.event(w.life, kind, activity))
    if (w.life.mode != EngineMode.TERMINAL) return@on
    when (kind) {
      EngineEvent.Kind.WORKING -> w.working = true
      EngineEvent.Kind.FINISHED -> {
        w.working = false
        turnEnded(w)
      }
      // Only after it worked (a program says idle, stopped, at its start
      // too), and never a guess (a quiet screen: the run may still work).
      EngineEvent.Kind.FAILED, EngineEvent.Kind.STOPPED -> if (w.working && !guessed) {
        w.working = false
        val end = if (kind == EngineEvent.Kind.FAILED) TurnEnd.FAILED else TurnEnd.STOPPED
        emit(agentId, LifeEvent.TurnEnded(EngineMode.TERMINAL, end))
      }
      else -> {}
    }
  }

  fun acpOpened(agentId: String) = on(agentId) { decide(it, rules.acpOpened(it.life)) }

  fun acpTurnEnded(agentId: String, stopReason: String?, error: String?) = on(agentId) { w ->
    if (w.life.mode != EngineMode.ACP) return@on
    when {
      error == null && stopReason == CheckRules.END_TURN -> turnEnded(w)
      error == null && stopReason == CANCELLED -> emit(agentId, LifeEvent.TurnEnded(EngineMode.ACP, TurnEnd.STOPPED))
      else -> emit(agentId, LifeEvent.TurnEnded(EngineMode.ACP, TurnEnd.FAILED))
    }
  }

  fun acpFailed(agentId: String, reason: String) = on(agentId) { decide(it, rules.acpFailed(it.life, reason)) }

  fun contact(agentId: String) = on(agentId) { decide(it, rules.contact(it.life)) }

  fun hook(agentId: String, event: String, wait: Boolean) = on(agentId) { decide(it, rules.hook(it.life, event, wait)) }

  fun receipt(agentId: String, ids: List<Long>) = on(agentId) { decide(it, rules.receipt(it.life, ids)) }

  fun served(agentId: String, call: InboxCall, status: Int) = on(agentId) { decide(it, rules.served(it.life, call, status)) }

  /** A wake-marked set left in its folder; [pending] reads the ids still there. */
  fun wakeSet(agentId: String, ids: List<Long>, pending: () -> Set<Long>) = on(agentId) { w ->
    if (rules.wakeSetWritten(w.life, ids)) {
      later(CheckRules.WAKE_RECEIPT_MS) {
        if (w.life.up && w.life.wakeSet == ids) decide(w, rules.wakeUnanswered(w.life, ids, pending()))
      }
    }
  }

  /** It exited on its own: the task rule, then the life's end. */
  fun exited(agentId: String, code: Int, died: Boolean, reason: String?, screen: ByteArray?, typed: Boolean) = post {
    lives.remove(agentId)?.let { w ->
      val lines = screen?.let { ScreenText.lastLines(ScreenText.strip(it)) }?.let { hide(it, w.secrets) }
      decide(w, rules.exited(w.life, code, lines, typed))
      close(w)
    }
    emit(agentId, LifeEvent.EngineEnded(failed = died, detail = reason.takeIf { died }))
  }

  /** ResumeFallback launches it again: this life ends here, and launched() brings the next. */
  fun relaunched(agentId: String, code: Int) = post {
    val w = lives.remove(agentId) ?: return@post
    decide(w, rules.relaunched(w.life, code))
    close(w)
  }

  /** Stopped by us, or its start failed. */
  fun ended(agentId: String, failed: Boolean, detail: String?) = post {
    lives.remove(agentId)?.let(::close)
    emit(agentId, LifeEvent.EngineEnded(failed, detail))
  }

  // S6 is read at the life's first turn end and again at its grace.
  private fun turnEnded(w: Watched) {
    val first = w.life.turnEnds == 0
    decide(w, rules.turnEnded(w.life, if (first) w.state?.wrote() else null))
    emit(w.life.agentId, LifeEvent.TurnEnded(w.life.mode))
    later(CheckRules.GRACE_MS) {
      if (w.life.up) decide(w, rules.afterGrace(w.life, first, if (first) w.state?.wrote() else null))
    }
  }

  private fun lookAtScreen(w: Watched) {
    if (!rules.looksAtScreen(w.life)) {
      w.poll?.cancel(false)
      return
    }
    val bytes = w.screen() ?: return
    decide(w, rules.screen(w.life, ScreenText.compact(ScreenText.strip(bytes))))
  }

  private fun close(w: Watched) {
    rules.ended(w.life)
    w.poll?.cancel(false)
  }

  private fun decide(w: Watched, verdicts: List<Verdict>) {
    for (v in verdicts) {
      val finding = "${v.failed}|${v.code}"
      if (w.recorded.put(v.capability, finding) == finding) continue
      guarded { onVerdict(w, v) }
    }
  }

  private fun emit(agentId: String, event: LifeEvent) = guarded { onLife(agentId, event) }

  // [text] without the agent's secrets, should its screen ever show one.
  private fun hide(text: String, secrets: List<String>): String =
    secrets.filter { it.length >= MIN_SECRET }.fold(text) { out, secret -> out.replace(secret, HIDDEN) }

  private fun on(agentId: String, block: (Watched) -> Unit) = post { lives[agentId]?.let(block) }

  private fun post(block: () -> Unit) {
    try {
      thread.execute { guarded(block) }
    } catch (_: RejectedExecutionException) {
      // The process is going away.
    }
  }

  private fun later(delayMs: Long, block: () -> Unit) {
    try {
      thread.schedule(Runnable { guarded(block) }, delayMs, TimeUnit.MILLISECONDS)
    } catch (_: RejectedExecutionException) {
      // The process is going away.
    }
  }

  private fun guarded(block: () -> Unit) {
    try {
      block()
    } catch (e: Exception) {
      Log.w(TAG, "capability check failed", e)
    }
  }

  private companion object {
    const val TAG = "PhoneCanDoChecks"
    const val MIN_SECRET = 6
    const val HIDDEN = "***"

    /** An ACP turn's stop reason when the client cancelled it (Stop, or Check now ending a part). */
    const val CANCELLED = "cancelled"
  }
}
