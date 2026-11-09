package com.phonecando.runner.engine.tui

import com.phonecando.agents.kit.EngineEvent
import com.phonecando.agents.kit.term.Signal
import com.phonecando.agents.kit.term.SignalRules

// A TUI engine's events, from the signals in its output: what the kind's
// PTY rules raise, and its chat title (group 1 of [titlePattern] in the
// window title); and what its events file raises (raise, from the event
// sink's thread). A TUI is one chat, so every event names the session
// SESSION. The chat board takes a title only for a chat it lists, which a
// TUI's first event creates, so the title known then follows each event; a
// new title goes out at once. A run left working with nothing on screen
// for QUIET_MS (quiet) is over: an interrupt raises no event of its own
// (Claude Code's Esc fires no hook), so it ends as stopped. Pure; the clock
// is injected for tests.
internal class TuiEvents(
  private val rules: SignalRules,
  private val titlePattern: Regex?,
  windowTitle: String?,
  private val clock: () -> Long = System::currentTimeMillis,
  private val onEvent: (EngineEvent) -> Unit,
) {
  private var title: String? = windowTitle?.let(::chatTitle)

  /** Epoch ms of the WORKING event the chat is still in; null when it is not working. */
  private var workingAt: Long? = null

  @Synchronized
  fun onSignals(signals: List<Signal>) {
    for (signal in signals) {
      if (signal is Signal.Title) {
        val next = chatTitle(signal.text) ?: continue
        title = next
        onEvent(titleEvent(next))
        continue
      }
      rules.eventFor(signal)?.let(::raise)
    }
  }

  /** An event of the TUI's one chat, with its title when known. */
  @Synchronized
  fun raise(kind: EngineEvent.Kind) {
    workingAt = if (kind == EngineEvent.Kind.WORKING) clock() else null
    onEvent(EngineEvent(kind, SESSION))
    title?.let { onEvent(titleEvent(it)) }
  }

  /** The TUI's last output was at [lastOutputAt]: a run working with nothing shown since QUIET_MS is stopped. */
  @Synchronized
  fun quiet(lastOutputAt: Long?) {
    val since = maxOf(workingAt ?: return, lastOutputAt ?: 0L)
    if (clock() - since >= QUIET_MS) raise(EngineEvent.Kind.STOPPED)
  }

  private fun chatTitle(windowTitle: String): String? =
    titlePattern?.find(windowTitle)?.groups?.takeIf { it.size > 1 }?.get(1)?.value?.takeIf { it.isNotBlank() }

  private fun titleEvent(title: String) = EngineEvent(EngineEvent.Kind.OTHER, SESSION, title = title)

  companion object {
    /** The one chat of a TUI engine. */
    const val SESSION = "tui"

    /** How long a working run may show nothing before it counts as stopped. */
    const val QUIET_MS = 30_000L
  }
}
