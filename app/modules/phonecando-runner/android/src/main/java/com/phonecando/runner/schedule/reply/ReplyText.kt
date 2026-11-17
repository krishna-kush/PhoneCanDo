package com.phonecando.runner.schedule.reply

// Every word a scheduled run's result notice shows (ReplyNotice). Pure.
object ReplyText {
  /** The text when the reply has none to show. */
  const val NO_TEXT = "Tap to see the result."

  private const val LINE_MAX = 120

  // A markdown heading's marks, before its words.
  private val HEADING = Regex("^#{1,6}(\\s+|$)")

  fun title(name: String, failed: Boolean): String =
    if (failed) "$name: scheduled task stopped with an error" else "$name: scheduled task done"

  /** The reply's first non-blank line (a heading without its marks), cut to LINE_MAX; NO_TEXT without one. */
  fun text(reply: String?): String {
    val line = reply?.lineSequence()
      ?.map { it.trim().replace(HEADING, "").trim() }
      ?.firstOrNull { it.isNotEmpty() }
      ?: return NO_TEXT
    return if (line.length <= LINE_MAX) line else line.take(LINE_MAX - 1).trimEnd() + "…"
  }
}
