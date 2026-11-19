package com.phonecando.runner.presence

// An agent's status line (agents_status): one line, control characters
// out, at most MAX_CHARS with "…" at the end; an empty text clears it. The
// same text and mood again within SAME_MS is ignored (a model repeating
// itself); again later it only freshens the status's time. A status goes
// at run end, with its engine, and STALE_MS after it was last set. Pure.
object StatusRules {
  const val MAX_CHARS = 80
  const val SAME_MS = 1_000L
  const val STALE_MS = 15 * 60_000L

  private const val ELLIPSIS = "…"

  sealed interface Change {
    /** Nothing to change. */
    data object Keep : Change

    data class Set(val status: AgentStatus) : Change

    data object Clear : Change
  }

  /** [raw] as the line shows it; null when nothing is left (clears the status). */
  fun clean(raw: String): String? {
    val line = buildString {
      for (c in raw) {
        when {
          c == '\n' || c == '\r' || c == '\t' -> append(' ')
          Character.isISOControl(c) || Character.getType(c) == Character.FORMAT.toInt() -> {}
          else -> append(c)
        }
      }
    }.replace(SPACES, " ").trim()
    if (line.isEmpty()) return null
    if (line.codePointCount(0, line.length) <= MAX_CHARS) return line
    val cut = line.offsetByCodePoints(0, MAX_CHARS - 1)
    return line.substring(0, cut).trimEnd() + ELLIPSIS
  }

  /** The mood [wire] names ("working", "thinking", "waiting"; WORKING when absent); null when it names none. */
  fun mood(wire: String?): StatusMood? =
    if (wire == null) StatusMood.WORKING else StatusMood.entries.firstOrNull { it.name.equals(wire, ignoreCase = true) }

  /** What [text] (already [clean]) in [mood] does to [prev] at [now]. */
  fun change(prev: AgentStatus?, text: String?, mood: StatusMood, now: Long): Change = when {
    text == null -> if (prev == null) Change.Keep else Change.Clear
    prev != null && prev.text == text && prev.mood == mood && now - prev.at < SAME_MS -> Change.Keep
    else -> Change.Set(AgentStatus(text, mood, now))
  }

  /** Not set again for STALE_MS. */
  fun stale(status: AgentStatus, now: Long): Boolean = now - status.at >= STALE_MS

  private val SPACES = Regex(" {2,}")
}
