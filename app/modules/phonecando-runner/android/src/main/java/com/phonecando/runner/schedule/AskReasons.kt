package com.phonecando.runner.schedule

import com.phonecando.runner.schedule.FireRules.Action
import com.phonecando.runner.schedule.FireRules.Engine

// Why a due task asked you instead of running (FireRules' ASK_USER rows),
// in plain words for the run's detail, the schedule's lastRun and the due
// notice, one per row:
//   ACP kind, terminal open on screen                  TERMINAL_OPEN
//   ACP kind, jobs left running                        "it had jobs running: <names>", or KEPT_RUNNING
//   other kind, stopped, wakes only by hook or reader  NO_START_TASK
//   other kind, takes a prompt, jobs left running      as above
//   other kind, takes a prompt, PhoneCanDo in front    APP_OPEN
//   other kind, its hook not waiting                   HOOK_NOT_WAITING
//   other kind, wakes only into the chat it has        NO_NEW_CHAT
// Firing adds its own: no leave to start in the background (NO_BACKGROUND_START),
// and why a start or a wake was refused. And whether tapping its due
// notice runs the task (tapRuns). Pure.
object AskReasons {
  const val TERMINAL_OPEN = "its terminal was open on screen"
  const val KEPT_RUNNING = "it was set to keep running"
  const val NO_START_TASK = "it can't take a task at start"
  const val APP_OPEN = "PhoneCanDo was open"
  const val HOOK_NOT_WAITING = "its hook wasn't waiting for a message"
  const val NO_NEW_CHAT = "it can't take a task in a new chat"

  /** Firing: work decided outside an alarm (or a restart) without exact alarms. */
  const val NO_BACKGROUND_START = "PhoneCanDo may not start or wake agents in the background without Alarms & reminders"

  /** For an ask that names no row (it should not happen): still a reason. */
  const val UNKNOWN = "it couldn't take the task on its own"

  /** Job names a reason lists before "and N more". */
  const val NAMES_MAX = 3

  /** Why [s] asks you; null when it doesn't (FireRules.decide is not ASK_USER). */
  fun of(s: FireRules.State): String? {
    if (FireRules.decide(s) != Action.ASK_USER) return null
    return if (s.acp) acp(s) else other(s)
  }

  /**
   * Whether tapping the due notice should run the task now: the agent can't
   * read the task left as a notice while its terminal runs (no phone tools,
   * no inbox), and the task has a way in (ACP mode or a start prompt).
   */
  fun tapRuns(s: FireRules.State): Boolean = !s.readsNotices && (s.acp || s.kindPrompts)

  /** "it had jobs running: a, b and 2 more"; [KEPT_RUNNING] with no names. */
  fun jobs(names: List<String>): String {
    val all = names.map { it.trim() }.filter { it.isNotEmpty() }.distinct()
    if (all.isEmpty()) return KEPT_RUNNING
    val shown = all.take(NAMES_MAX).joinToString(", ")
    val more = all.size - NAMES_MAX
    return "it had jobs running: $shown" + if (more > 0) " and $more more" else ""
  }

  // An ACP kind asks only when idle in terminal mode, watched or with jobs.
  private fun acp(s: FireRules.State): String = when {
    s.viewer -> TERMINAL_OPEN
    s.jobs -> jobs(s.jobNames)
    else -> UNKNOWN
  }

  private fun other(s: FireRules.State): String = when {
    s.engine == Engine.STOPPED -> NO_START_TASK
    s.kindPrompts && s.jobs -> jobs(s.jobNames)
    s.kindPrompts && s.appInFront -> APP_OPEN
    s.kindWakes && !s.wakeReady -> HOOK_NOT_WAITING
    s.kindWakes -> NO_NEW_CHAT
    else -> UNKNOWN
  }
}
