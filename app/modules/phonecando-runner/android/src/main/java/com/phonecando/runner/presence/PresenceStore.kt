package com.phonecando.runner.presence

import com.phonecando.runner.bridge.ScreenLease
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

// The presence's state: the hand-over to you (HandsRules decides each
// step), who waits in a hand-over call, and each agent's status line
// (StatusRules). What a step means outside goes through [effects], after
// the lock: the lease's time stands still while you have the controls
// (freeze, thaw), the resume note, and a change to show.
// A run that ends during its agent's hand-over keeps the screen for it
// (runEnded says so, and the lease hears it only if you leave it stopped);
// an engine gone ends its hand-over with no note.
// A wait (/hands/wait, a WATCH /hands/over) blocks on the caller's own
// thread while you have the controls in WATCH (Let me: a pause, the agent
// goes on in the same turn), until you hand the phone back or its time is
// up. A Stop ends a wait at once and stops its turn where its kind can
// (Effects.stopTurn): the agent really stops, and the note sends it on
// when you start it again. A kind that can't be stopped is told to end its
// turn; a screen call of a paused agent's after its first (pausedCall)
// means it did not, and its turn is stopped again. Leave it keeps it
// stopped: the screen goes at once, and a run still going stays off it
// (leftStopped: its screen calls are refused as paused, each stops its
// turn) until that run ends; its next run drives as normal. Pure apart
// from the effects; the clock is injected.
class PresenceStore(private val clock: () -> Long, private val effects: Effects) {
  interface Effects {
    /** The agent driving the screen now, else the one holding it, idle or not; null when nobody. */
    fun target(): ScreenLease.Seat?

    /** A hand-over for [seat] began: its time on the screen stands still. */
    fun freeze(seat: ScreenLease.Seat)

    /** Its hand-over ended: its time runs again; [giveBack]: and the screen goes (its run ended meanwhile, or you left it stopped). */
    fun thaw(agentId: String, giveBack: Boolean)

    /** You stopped [agentId] (Stop, Leave it, or a screen call after): stop its turn where its kind can. */
    fun stopTurn(agentId: String)

    /** The note to go on after a hand-over in [after]. */
    fun resume(agentId: String, after: HandMode)

    /** The hand-over or a status changed. */
    fun changed()
  }

  /** How a wait for the hand-over ended. */
  enum class Wait {
    /** You handed the phone back (or it was never handed over). */
    BACK,

    /** Still yours, in WATCH: the time ran out. */
    WATCH,

    /** You stopped the agent: it ends its turn. */
    PAUSED,
  }

  private val lock = ReentrantLock()
  private val turned = lock.newCondition()

  private var handOver: HandOver? = null
  private val waiters = HashMap<String, Int>()

  // Screen calls refused in the Stop now (paused_by_user).
  private var pausedCalls = 0
  private val runOver = HashSet<String>()

  // Left stopped while their run still went on: off the screen until it ends.
  private val left = HashSet<String>()
  private val statuses = LinkedHashMap<String, AgentStatus>()

  fun handOver(): HandOver? = lock.withLock { handOver }

  /** You left [agentId] stopped and the run it was stopped in still goes on: it stays off the screen. */
  fun leftStopped(agentId: String): Boolean = lock.withLock { agentId in left }

  fun statuses(): Map<String, AgentStatus> = lock.withLock { LinkedHashMap(statuses) }

  fun frame(driver: ScreenLease.Seat?): PresenceFrame = lock.withLock { PresenceFrame(driver, handOver, LinkedHashMap(statuses)) }

  /** One of your buttons; false when it does not apply now. */
  fun user(act: UserAct): Boolean {
    val target = if (act == UserAct.LET_ME || act == UserAct.STOP) effects.target() else null
    val (step, giveBack) = lock.withLock {
      val now = handOver
      val waiting = now != null && (waiters[now.agentId] ?: 0) > 0
      val step = HandsRules.user(act, now, target, waiting, clock())
      step to apply(step)
    }
    val done = after(step, giveBack)
    // Stop really stops: its turn now, not at its next screen call.
    if (act == UserAct.STOP && step is HandsRules.Step.Started) effects.stopTurn(step.handOver.agentId)
    return done
  }

  /**
   * The agent hands you the controls ([private]: PAUSED); null while a
   * hand-over is on (user_has_controls).
   */
  fun agent(agentId: String, agentName: String, why: String, private: Boolean): HandOver? {
    val (step, giveBack) = lock.withLock {
      val step = if (agentId in left) HandsRules.Step.Refused else HandsRules.agent(agentId, agentName, why, private, handOver, clock())
      step to apply(step)
    }
    after(step, giveBack)
    return (step as? HandsRules.Step.Started)?.handOver
  }

  /** Blocks up to [timeoutMs] while [agentId]'s hand-over is on in WATCH. */
  fun await(agentId: String, timeoutMs: Long): Wait = lock.withLock {
    waiters[agentId] = (waiters[agentId] ?: 0) + 1
    try {
      var left = TimeUnit.MILLISECONDS.toNanos(timeoutMs.coerceAtLeast(0))
      var wait = waitOf(agentId)
      while (wait == Wait.WATCH && left > 0) {
        left = turned.awaitNanos(left)
        wait = waitOf(agentId)
      }
      wait
    } finally {
      val n = (waiters[agentId] ?: 1) - 1
      if (n > 0) waiters[agentId] = n else waiters.remove(agentId)
    }
  }

  // Under the lock: where [agentId]'s hand-over is now.
  private fun waitOf(agentId: String): Wait {
    val now = handOver
    return when {
      now?.agentId != agentId -> Wait.BACK
      now.mode == HandMode.PAUSED -> Wait.PAUSED
      else -> Wait.WATCH
    }
  }

  /**
   * A screen call of [agentId]'s was refused while you stopped it. The
   * first is how it learns of the Stop; one after that, it did not stop,
   * and its turn is stopped where its kind can.
   */
  fun pausedCall(agentId: String) {
    val again = lock.withLock {
      if (agentId in left) return@withLock true
      val now = handOver
      if (now?.agentId != agentId || now.mode != HandMode.PAUSED) return
      ++pausedCalls > 1
    }
    if (again) effects.stopTurn(agentId)
  }

  /**
   * [agentId]'s run ended: its status goes. True when its hand-over is on:
   * the lease keeps the screen for it and hears of the end only if you
   * leave it stopped.
   */
  fun runEnded(agentId: String): Boolean {
    val (cleared, held) = lock.withLock {
      val held = handOver?.agentId == agentId
      if (held) runOver += agentId
      left -= agentId
      (statuses.remove(agentId) != null) to held
    }
    if (cleared) effects.changed()
    return held
  }

  /** [agentId]'s engine is gone: its hand-over ends with no note, and its status goes. */
  fun forget(agentId: String) {
    val (ended, cleared) = lock.withLock {
      runOver -= agentId
      left -= agentId
      val ended = handOver?.takeIf { it.agentId == agentId }
      if (ended != null) {
        handOver = null
        turned.signalAll()
      }
      ended to (statuses.remove(agentId) != null)
    }
    if (ended != null) effects.thaw(agentId, giveBack = false)
    if (ended != null || cleared) effects.changed()
  }

  /** Every hand-over and status goes (no bridge: nobody drives). */
  fun clear() {
    val had = lock.withLock {
      val had = handOver != null || statuses.isNotEmpty()
      handOver = null
      runOver.clear()
      left.clear()
      statuses.clear()
      turned.signalAll()
      had
    }
    if (had) effects.changed()
  }

  /** [agentId] says what it does now ([raw]: empty clears it). */
  fun status(agentId: String, raw: String, mood: StatusMood) {
    val text = StatusRules.clean(raw)
    val changed = lock.withLock {
      when (val change = StatusRules.change(statuses[agentId], text, mood, clock())) {
        StatusRules.Change.Keep -> false
        StatusRules.Change.Clear -> statuses.remove(agentId) != null
        is StatusRules.Change.Set -> {
          statuses[agentId] = change.status
          true
        }
      }
    }
    if (changed) effects.changed()
  }

  /** Time moves on: stale statuses go. */
  fun tick() {
    val dropped = lock.withLock {
      val now = clock()
      statuses.entries.removeAll { StatusRules.stale(it.value, now) }
    }
    if (dropped) effects.changed()
  }

  // Under the lock: the step's new state; true when the screen goes back
  // with the end: you left it stopped (a run still going stays off it).
  private fun apply(step: HandsRules.Step): Boolean = when (step) {
    is HandsRules.Step.Started -> {
      handOver = step.handOver
      pausedCalls = 0
      turned.signalAll()
      false
    }
    is HandsRules.Step.Ended -> {
      handOver = null
      pausedCalls = 0
      turned.signalAll()
      val ended = runOver.remove(step.handOver.agentId)
      val leave = step.then == HandsRules.Then.NONE
      if (leave && !ended) left += step.handOver.agentId
      leave
    }
    HandsRules.Step.Refused -> false
  }

  private fun after(step: HandsRules.Step, giveBack: Boolean): Boolean {
    when (step) {
      is HandsRules.Step.Started -> {
        val h = step.handOver
        if (!step.switched) effects.freeze(ScreenLease.Seat(h.agentId, h.agentName))
      }
      is HandsRules.Step.Ended -> {
        val h = step.handOver
        effects.thaw(h.agentId, giveBack)
        if (step.then == HandsRules.Then.RESUME) effects.resume(h.agentId, h.mode)
        if (leftStopped(h.agentId)) effects.stopTurn(h.agentId)
      }
      HandsRules.Step.Refused -> return false
    }
    effects.changed()
    return true
  }
}
