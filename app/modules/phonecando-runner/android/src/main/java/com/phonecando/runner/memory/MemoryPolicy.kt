package com.phonecando.runner.memory

import com.phonecando.runner.memory.MemoryRules.CRITICAL_COUNTDOWN_MS
import com.phonecando.runner.memory.MemoryRules.CRITICAL_MARGIN
import com.phonecando.runner.memory.MemoryRules.NEXT_COUNTDOWN_MS
import com.phonecando.runner.memory.MemoryRules.OK_HYSTERESIS_PERCENT
import com.phonecando.runner.memory.MemoryRules.SETTLE_MS
import com.phonecando.runner.memory.MemoryRules.WARN_COUNTDOWN_MS
import com.phonecando.runner.memory.MemoryRules.WARN_MARGIN
import com.phonecando.runner.memory.MemoryRules.WARN_PERCENT

// What the memory guard decides, one look at a time: how close the phone
// is to running out (a MemoryLevel, with hysteresis on the way back to
// ok), when the runner stops an agent by itself, and which one. An episode
// runs from leaving ok until back at ok; the countdown, the settling after
// a stop and the count of stops belong to it. The numbers are MemoryRules;
// MemoryGuard feeds it readings and does the stopping. Pure.
object MemoryPolicy {
  /** The lines a reading is held against: warn under [warnBelow], critical under [criticalBelow], ok again from [okFrom]. */
  data class Lines(val warnBelow: Long, val criticalBelow: Long, val okFrom: Long)

  fun lines(r: MemoryReading): Lines {
    val warn = maxOf(r.totalBytes * WARN_PERCENT / 100, r.thresholdBytes + WARN_MARGIN)
    return Lines(warn, r.thresholdBytes + CRITICAL_MARGIN, warn + r.totalBytes * OK_HYSTERESIS_PERCENT / 100)
  }

  /** The level of [r], coming from [previous]: leaving warn or critical takes the hysteresis. */
  fun level(r: MemoryReading, previous: MemoryLevel): MemoryLevel {
    val lines = lines(r)
    return when {
      r.lowMemory || r.availBytes < lines.criticalBelow -> MemoryLevel.CRITICAL
      r.availBytes < lines.warnBelow -> MemoryLevel.WARN
      previous != MemoryLevel.OK && r.availBytes < lines.okFrom -> MemoryLevel.WARN
      else -> MemoryLevel.OK
    }
  }

  /** Where the guard is in an episode. */
  data class State(
    val level: MemoryLevel = MemoryLevel.OK,
    /** The countdown from entering warn (after a stop: the next one); null: none. */
    val warnStopAt: Long? = null,
    /** The shorter countdown while critical; null when not critical. */
    val criticalStopAt: Long? = null,
    /** After a stop, no countdown before this. */
    val settleUntil: Long? = null,
    /** Agents stopped in this episode. */
    val stops: Int = 0,
  ) {
    /** When the next agent is stopped; null with no countdown. */
    val stopAt: Long? get() = warnStopAt?.let { w -> minOf(w, criticalStopAt ?: w) }
  }

  /** The next state, and whether to stop the agent victim() picked now (the state then settles). */
  data class Step(val state: State, val stop: Boolean)

  /** One look: [level] now (level()); [canStop]: victim() found an agent. */
  fun step(state: State, level: MemoryLevel, canStop: Boolean, now: Long): Step {
    if (level == MemoryLevel.OK) return Step(State(), false)
    var s = state.copy(level = level)
    s.settleUntil?.let { until ->
      if (now < until) return Step(s, false)
      s = s.copy(settleUntil = null)
    }
    // Nothing may be stopped: keep warning, with no countdown.
    if (!canStop) return Step(s.copy(warnStopAt = null, criticalStopAt = null), false)
    if (s.warnStopAt == null) s = s.copy(warnStopAt = now + if (s.stops == 0) WARN_COUNTDOWN_MS else NEXT_COUNTDOWN_MS)
    s = s.copy(criticalStopAt = if (level == MemoryLevel.CRITICAL) s.criticalStopAt ?: (now + CRITICAL_COUNTDOWN_MS) else null)
    if (now < checkNotNull(s.stopAt)) return Step(s, false)
    return Step(s.copy(warnStopAt = null, criticalStopAt = null, settleUntil = now + SETTLE_MS, stops = s.stops + 1), true)
  }

  /** Nothing of ours runs any more: no countdown; the level and the episode stay until the next look. */
  fun idle(state: State): State = state.copy(warnStopAt = null, criticalStopAt = null, settleUntil = null)

  /**
   * An engine starting or ready. [working]: a run is going (its kind's idle
   * rule says it is not idle); [busy]: it left a job running (a dev server,
   * a download) or the user keeps it running.
   */
  data class Candidate(val agentId: String, val working: Boolean, val lastUsedAt: Long?, val busy: Boolean = false)

  /**
   * The agent to stop next: never [keep] (the one open on screen while the
   * app is in front); agents with no run going first, and of those the ones
   * with no job left, least recently used first; then working ones the same
   * way. Null: none may be stopped.
   */
  fun victim(agents: List<Candidate>, keep: String?): String? =
    agents.filter { it.agentId != keep }
      .minWithOrNull(compareBy<Candidate>({ it.working }, { it.busy }, { it.lastUsedAt ?: 0L }, { it.agentId }))
      ?.agentId
}
