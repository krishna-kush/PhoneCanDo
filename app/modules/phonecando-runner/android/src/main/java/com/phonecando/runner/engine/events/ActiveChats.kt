package com.phonecando.runner.engine.events

// A server engine's chats the board shows working, held against the chats
// its server says run now (its kind's `chats.active`). An event stream can
// leave a chat working with no verdict to come: a verdict lost while the
// stream reconnected, an event the kind's parser takes for work that
// started none. Once the agent has shown no activity (an event other than
// OTHER) for its kind's idle.quietSec while a chat shows working, the
// server is asked, at most once per that span; each working chat it does
// not name ends as a guessed stop (EngineEvent.guessed: no alert, no sign
// of use, the checks skip it), which takes it off the board. A run that
// works quietly (a long command) is named, so it stays; no answer changes
// nothing. Pure over its injected parts; a timer calls tick().
internal class ActiveChats(
  private val quietMs: Long,
  /** The chats the board shows working now. */
  private val working: () -> List<String>,
  /** The chats the server runs now; null when it did not answer. */
  private val ask: () -> Set<String>?,
  /** Ends one of them as a guessed stop. */
  private val stop: (sessionId: String) -> Unit,
  private val clock: () -> Long = System::currentTimeMillis,
) {
  @Volatile private var lastActivityAt = clock()

  @Volatile private var askedAt: Long? = null

  /** The stream showed activity. */
  fun heard() {
    lastActivityAt = clock()
  }

  /** One look: asks the server when it is due, and stops what it does not run. */
  fun tick() {
    val now = clock()
    if (now - lastActivityAt < quietMs) return
    askedAt?.let { if (now - it < quietMs) return }
    val shown = working()
    if (shown.isEmpty()) return
    askedAt = now
    val running = ask() ?: return
    shown.filter { it !in running }.forEach(stop)
  }

  companion object {
    /** The quiet span for a kind without an idle rule. */
    const val QUIET_DEFAULT_SEC = 60

    /** How often a server engine's timer looks. */
    const val TICK_MS = 10_000L
  }
}
