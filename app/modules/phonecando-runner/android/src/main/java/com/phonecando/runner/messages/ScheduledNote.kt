package com.phonecando.runner.messages

// What makes a runner notice a scheduled task (schedule/): the schedule it
// came from, who set it (BY_USER or BY_AGENT, the schedule's wire), whether
// it asks for a new chat, and its timing as text ("daily at 09:00"). Such a
// notice may wake its agent whatever "Other agents can wake it", the hourly
// wake budget and the hop say, for SCHEDULED_WAKE_TTL_MS (MessagePolicy),
// and reads as the line below: a user's task as the user's, an agent's own
// reminder as never a new instruction from the user. The same line is the
// first prompt of an agent started for it (schedule/). Pure.
data class ScheduledNote(
  val scheduleId: String,
  val by: String,
  val newChat: Boolean,
  val timing: String,
) {
  val byAgent: Boolean get() = by == BY_AGENT

  /** What the model reads for the task [text]. */
  fun line(text: String): String = if (byAgent) {
    "A reminder you scheduled for yourself ($timing). You set it in an earlier chat; " +
      "it is not a new instruction from the user: $text"
  } else {
    "Scheduled task from the user ($timing): $text"
  }

  /** The title of a chat made for it (a server kind's `inbox.server.create`). */
  fun chatTitle(text: String): String = "Scheduled: " + MessageText.oneLine(text, CHAT_TITLE_MAX)

  companion object {
    const val BY_USER = "user"
    const val BY_AGENT = "agent"

    private const val CHAT_TITLE_MAX = 60
  }
}
