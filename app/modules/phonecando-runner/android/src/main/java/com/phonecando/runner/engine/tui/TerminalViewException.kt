package com.phonecando.runner.engine.tui

/** Why a viewer cannot use an engine's terminal; [code] is what JS matches (the engineTerminal* functions). */
internal class TerminalViewException(val code: String, detail: String) : Exception("$code: $detail") {
  companion object {
    /** The agent's engine is not a running TUI engine. */
    const val NOT_RUNNING = "not_running"

    /** The engine stopped or died, and its last output was read. */
    const val ENDED = "ended"

    /** Another viewer attached since. */
    const val DETACHED = "detached"
  }
}
