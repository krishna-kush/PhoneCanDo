package com.phonecando.runner.engine.acp

// Whether an ACP turn went silent: for SILENT_MS nothing showed that the
// agent is still on it. Signs: anything the agent sends for the turn (text,
// thinking, a tool call or its update, a permission question: AcpAgent
// tells sign()), and, for as long as each lasts, a question open for you,
// a tool call still running (not completed or failed: a long build sends
// nothing) or the local model it runs on busy with its request (reading
// the prompt takes minutes on a small phone, and the agent sends nothing
// until then). A silent turn is one the agent will not get out of by
// itself: it waits on something only its own app shows (a sign-in, a
// folder to trust) or on its provider (a used-up limit it retries for
// minutes). AcpAgent cancels it, so the start a message or a task made
// never hangs there unseen. Not thread-safe; pure: the clock is the
// caller's.
internal class AcpTurnWatch(startedAt: Long, private val silentMs: Long = SILENT_MS) {
  private var lastSign = startedAt

  /** The agent sent something for the turn at [now]. */
  fun sign(now: Long) {
    if (now > lastSign) lastSign = now
  }

  /** A look at [now]; [holding]: a question, a tool call or its model is still on it. True once silent. */
  fun silent(now: Long, holding: Boolean): Boolean {
    if (holding) {
      sign(now)
      return false
    }
    return now - lastSign >= silentMs
  }

  companion object {
    /** How long a turn may show nothing before we cancel it. */
    const val SILENT_MS = 3 * 60_000L

    /** How often a running turn is looked at. */
    const val LOOK_MS = 10_000L

    private const val MINUTES = SILENT_MS / 60_000L

    /** Why a silent turn ended: the turn's error, its engine's status and the notice. */
    const val REASON = "It said nothing for $MINUTES minutes, so we stopped it. Open it: it may be waiting for you " +
      "there (to sign in or to trust its folder), or it hit a usage limit."

    /** Why its next start is held back (StartHolds), after "it failed under 10 minutes ago". */
    const val HOLD_WHY = "its last turn said nothing for $MINUTES minutes, so we stopped it"

    /** A tool call of [items] still runs: not completed or failed (pending and no status included). */
    fun toolRunning(items: List<AcpItem>): Boolean = items.any { it is AcpItem.Tool && it.status !in ENDED }

    private val ENDED = setOf("completed", "failed")
  }
}
