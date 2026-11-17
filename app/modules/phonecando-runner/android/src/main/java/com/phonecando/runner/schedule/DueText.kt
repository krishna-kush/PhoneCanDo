package com.phonecando.runner.schedule

import com.phonecando.runner.messages.MessageText

// What a due notice (DueNotice) says: "<agent>: scheduled task due", then
// the task's first line and why it asked (AskReasons). When a tap runs the
// task (AskReasons.tapRuns: the agent can't read a notice), the first line
// says so; else the task waits as a notice for the agent's next turn. Pure.
object DueText {
  /** The task's line is cut to this. */
  const val TASK_MAX = 120

  const val TAP_TO_RUN = "Tap to run it now"
  const val NEXT_TURN = "the agent gets it on its next turn"

  fun title(agentName: String): String = "$agentName: scheduled task due"

  /** The notice's text: the task's line, then why on a line of its own ([why] null: none). */
  fun text(task: String, why: String?, tapRuns: Boolean): String {
    val line = MessageText.oneLine(task, TASK_MAX)
    val first = if (tapRuns) "$TAP_TO_RUN: $line" else line
    val reason = why?.trim()?.takeIf { it.isNotEmpty() } ?: return first
    val second = if (tapRuns) "It didn't run because $reason." else "It didn't run because $reason; $NEXT_TURN."
    return "$first\n$second"
  }
}
