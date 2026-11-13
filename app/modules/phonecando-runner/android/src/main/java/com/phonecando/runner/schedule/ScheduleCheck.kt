package com.phonecando.runner.schedule

import com.phonecando.runner.messages.MessageText

/** A value read or checked, or why it could not be. */
sealed interface Checked<out T> {
  data class Ok<T>(val value: T) : Checked<T>

  data class Bad(val why: String) : Checked<Nothing>
}

// What a task's text and timing must be, whoever sets it (the app or the
// schedule_add tool): text cleaned as messages are (MessageText) and 1 to
// MAX_TEXT characters, never cut; a once in the future and at most
// ONCE_MAX_AHEAD away; a repeat of EVERY_MIN_MINUTES to MAX_MINUTES; a
// daily time within the day. The reasons are plain enough for the model
// and the app to show. Pure.
object ScheduleCheck {
  fun text(raw: String): Checked<String> {
    val text = MessageText.clean(raw)
    return when {
      text.isEmpty() -> Checked.Bad("the task text is empty")
      text.length > ScheduleRules.MAX_TEXT ->
        Checked.Bad("the task text is ${text.length} characters, over ${ScheduleRules.MAX_TEXT}; shorten it")
      else -> Checked.Ok(text)
    }
  }

  /** Why [timing] cannot be set at [now]; null when it can. */
  fun timing(timing: Timing, now: Long): String? = when (timing) {
    is Timing.Once -> when {
      timing.at <= now -> "that time is in the past"
      timing.at - now > ScheduleRules.ONCE_MAX_AHEAD_MS -> "that is more than ${ScheduleRules.ONCE_MAX_AHEAD_DAYS} days ahead"
      else -> null
    }
    is Timing.Every -> when {
      timing.minutes < ScheduleRules.EVERY_MIN_MINUTES -> "repeat every ${ScheduleRules.EVERY_MIN_MINUTES} minutes at the most often"
      timing.minutes > ScheduleRules.MAX_MINUTES -> "repeat at least every ${ScheduleRules.ONCE_MAX_AHEAD_DAYS} days"
      else -> null
    }
    is Timing.Daily -> if (timing.minuteOfDay in 0 until 24 * 60) null else "the time of day is not valid"
  }
}
