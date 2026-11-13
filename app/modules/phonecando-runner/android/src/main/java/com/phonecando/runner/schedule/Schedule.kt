package com.phonecando.runner.schedule

import java.time.DayOfWeek

// One scheduled task: what an agent is told (text), when (timing), in which
// chat, whether it is on, who set it (the user on the Schedules page, or the
// agent for itself with schedule_add), and when it runs next. nextAt is null
// for a once that ran and for one that is off. Times are epoch ms; a daily
// time is in the phone's zone when it is worked out (NextRun). Pure.
data class Schedule(
  /** "s" + 10 base32 characters (ScheduleIds). */
  val id: String,
  val agentId: String,
  /** MessageText.clean, 1..ScheduleRules.MAX_TEXT characters. */
  val text: String,
  val timing: Timing,
  val chat: ChatMode,
  val on: Boolean,
  val by: SetBy,
  val createdAt: Long,
  val nextAt: Long?,
  val lastRun: LastRun?,
)

sealed interface Timing {
  /** It runs again after it ran. */
  val repeats: Boolean

  data class Once(val at: Long) : Timing {
    override val repeats: Boolean get() = false
  }

  /** Every [minutes], on the grid that starts at [anchor] (its first run is the first grid time after it was set). */
  data class Every(val minutes: Int, val anchor: Long) : Timing {
    override val repeats: Boolean get() = true
  }

  /** At [minuteOfDay] (0..1439) in the phone's zone, on [days] (empty: every day). */
  data class Daily(val minuteOfDay: Int, val days: Set<DayOfWeek>) : Timing {
    override val repeats: Boolean get() = true
  }
}

/** NEW: a fresh chat for each run (repeating ones by default); SAME: the agent's current chat (one-offs by default). */
enum class ChatMode(val wire: String) {
  NEW("new"),
  SAME("same"),
  ;

  companion object {
    fun of(wire: String?): ChatMode? = entries.firstOrNull { it.wire == wire }

    /** The default for [timing]. */
    fun defaultFor(timing: Timing): ChatMode = if (timing.repeats) NEW else SAME
  }
}

enum class SetBy(val wire: String) {
  USER("user"),
  AGENT("agent"),
  ;

  companion object {
    fun of(wire: String?): SetBy? = entries.firstOrNull { it.wire == wire }
  }
}

/** The last time it came due and what came of it; [detail] says why for failed, asked and missed. */
data class LastRun(val at: Long, val outcome: RunOutcome, val detail: String?)

/** What one firing came to (the runs log and lastRun; the wire is what JS and the file see). */
enum class RunOutcome(val wire: String) {
  /** A stopped agent started with the task as its first prompt, or started, then woken. */
  STARTED("started"),

  /** A running idle agent got it and a run started. */
  WOKE("woke"),

  /** An idle agent restarted with the task as its first prompt. */
  RESTARTED("restarted"),

  /** It could not run alone: a notification asks you to open the agent; the task waits as a notice. */
  ASKED("asked"),

  /** The agent stayed busy BUSY_WAIT past due: skipped. */
  BUSY("busy"),

  /** More than LATE_MAX late (the phone was off): not run. */
  MISSED("missed"),

  /** Start failed, agent gone, or its kind cannot run schedules. */
  FAILED("failed"),
  ;

  companion object {
    fun of(wire: String?): RunOutcome? = entries.firstOrNull { it.wire == wire }
  }
}
