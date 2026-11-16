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
// new title goes out at once. A window title the pattern rejects (Claude
// Code's "✳ Claude Code" in a fresh chat) means the TUI shows no chat
// title: the last one goes, and a blank title event clears it on the
// board, so a new chat never wears the old one's. A run left working with
// nothing on screen (quiet) is over when you typed into it since it began
// and it then showed nothing for QUIET_MS: an interrupt raises no event of
// its own (Claude Code's Esc fires no hook), and only you can type one. A
// TUI nobody looks at is unfocused and may show nothing while it works
// (a slow model), so without your typing only QUIET_MAX_MS of nothing
// ends it (a hook that never fired). Either way it ends as stopped, a
// guess the event says it is (EngineEvent.guessed). Pure; the clock is
// injected for tests.
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
        val next = chatTitle(signal.text)
        if (next == title) continue
        title = next
        onEvent(titleEvent(next ?: ""))
        continue
      }
      rules.eventFor(signal)?.let(::raise)
    }
  }

  /** An event of the TUI's one chat, with its title when known. */
  @Synchronized
  fun raise(kind: EngineEvent.Kind, guessed: Boolean = false) {
    workingAt = if (kind == EngineEvent.Kind.WORKING) clock() else null
    onEvent(EngineEvent(kind, SESSION, guessed = guessed))
    title?.let { onEvent(titleEvent(it)) }
  }

  /**
   * The TUI's last output was at [lastOutputAt], your last typing into it
   * at [lastInputAt]: a run working with nothing shown since is stopped
   * after QUIET_MS when you typed since it began, else after QUIET_MAX_MS.
   */
  @Synchronized
  fun quiet(lastOutputAt: Long?, lastInputAt: Long?) {
    val began = workingAt ?: return
    val still = clock() - maxOf(began, lastOutputAt ?: 0L)
    val typed = lastInputAt != null && lastInputAt >= began
    if (still >= (if (typed) QUIET_MS else QUIET_MAX_MS)) raise(EngineEvent.Kind.STOPPED, guessed = true)
  }

  private fun chatTitle(windowTitle: String): String? =
    titlePattern?.find(windowTitle)?.groups?.takeIf { it.size > 1 }?.get(1)?.value?.takeIf { it.isNotBlank() }

  private fun titleEvent(title: String) = EngineEvent(EngineEvent.Kind.OTHER, SESSION, title = title)

  companion object {
    /** The one chat of a TUI engine. */
    const val SESSION = "tui"

    /** How long a working run you typed into may show nothing before it counts as stopped. */
    const val QUIET_MS = 30_000L

    /** How long a working run may show nothing, with no typing, before it counts as stopped (a hook that never fired). */
    const val QUIET_MAX_MS = 30 * 60_000L
  }
}
