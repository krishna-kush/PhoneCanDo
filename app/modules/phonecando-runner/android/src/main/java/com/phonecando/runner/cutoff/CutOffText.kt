package com.phonecando.runner.cutoff

import com.phonecando.runner.cutoff.CutOffLook.Why

// Every word a run cut off shows: its notice (CutOffNotice), the note the
// agent reads to go on, and the line its scheduled run gets. Pure.
object CutOffText {
  const val CONTINUE = "Continue in the same chat?"
  const val OPEN = "Open it to go on."
  const val AGAIN = "It was cut off again, so open it to go on."
  const val WAIT = "Another agent is still starting. Tap Continue again in a moment."
  const val CHECKING = "A Check now is running on it. Continue once it is done."
  const val INSTALLING = "Its machine is installing an agent. Continue once that is done."
  const val REFUSED = "Android did not let PhoneCanDo start it now. Open it to go on."
  const val NOT_TAKEN = "It started, but did not take the note to go on. Open it to go on."
  const val STOPPED = "It stopped by itself while starting. Open it to go on."

  /** The button labels. */
  const val CONTINUE_LABEL = "Continue"
  const val OPEN_LABEL = "Open"
  const val DISMISS_LABEL = "Dismiss"

  fun title(name: String): String = "$name: cut off mid-task"

  /** What happened, then [ask] (one of the lines above, or failed/noRoom). */
  fun text(why: Why, chatTitle: String?, ask: String): String {
    val what = chatTitle?.let { "while it worked on “$it”" } ?: "while it was working"
    return "${cause(why)} $what. $ask"
  }

  /** A bring-back start that failed, with why. */
  fun failed(error: String?): String =
    "It did not start" + (error?.trim()?.takeIf { it.isNotEmpty() }?.let { " ($it)" } ?: "") + ". Open it to go on."

  /** No room to start it now ([why]: what the room check said, engine/starts/StartRoom). */
  fun noRoom(why: String): String =
    "${why.trim().trimEnd('.').replaceFirstChar { it.uppercase() }}. Continue once there is room."

  /** The note the agent reads as it goes on. */
  fun goOn(why: Why): String =
    "Note from PhoneCanDo: ${lead(why)} while you were working in this chat, so your last task stopped part way. " +
      "Anything you had running, such as servers or builds, stopped too. Check where you got to, then go on with " +
      "the task from there; don't redo steps that are done. If you were waiting for the user's answer, ask again."

  /** What a cut-off scheduled run's detail gets when it is brought back ([time]: "10:42"). */
  fun broughtNote(time: String): String = "brought back at $time"

  private fun cause(why: Why): String = when (why) {
    Why.REBOOT -> "The phone restarted"
    Why.UPDATE -> "PhoneCanDo was updated"
    Why.CLOSED -> "Android closed PhoneCanDo"
    Why.DIED -> "It stopped by itself"
  }

  private fun lead(why: Why): String = when (why) {
    Why.REBOOT -> "the phone restarted"
    Why.UPDATE -> "PhoneCanDo was updated"
    Why.CLOSED -> "Android closed PhoneCanDo"
    Why.DIED -> "your program stopped by itself"
  }
}
