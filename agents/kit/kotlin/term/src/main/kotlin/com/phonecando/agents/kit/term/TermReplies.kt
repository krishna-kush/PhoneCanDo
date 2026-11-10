package com.phonecando.agents.kit.term

// What a terminal writes back to its program, for a TUI that runs with or
// without anyone watching: the answer to the Program Status Protocol's
// support query (ProgramStatus.reply), and focus reports (CSI I in, CSI O
// out) while the program has asked for them (DEC private mode 1004, until
// it resets the mode or the terminal: RIS). The terminal starts unfocused
// (nobody shows a fresh TUI); focus() moves it. As xterm.js does, turning
// the mode on reports the focus at once, so a program that takes itself to
// be focused learns otherwise. Only a change of focus reports again. Pure;
// one per stream, not thread-safe (the owner locks).
class TermReplies {
  /** Whether the terminal counts as focused. */
  var focused = false
    private set

  /** Whether the program asked for focus reports. */
  var focusReports = false
    private set

  /** What the terminal answers to [signal] in the program's output, or null. */
  fun onSignal(signal: Signal): ByteArray? = when (signal) {
    is Signal.StatusQuery -> ProgramStatus.reply(signal.bel)
    is Signal.Modes -> if (FOCUS_MODE in signal.modes) {
      focusReports = signal.set
      if (signal.set) report() else null
    } else {
      null
    }
    Signal.Reset -> {
      focusReports = false
      null
    }
    else -> null
  }

  /** The terminal gains or loses focus: the report that calls for, or null (no change, or no reports asked for). */
  fun focus(focused: Boolean): ByteArray? {
    if (this.focused == focused) return null
    this.focused = focused
    return if (focusReports) report() else null
  }

  private fun report() = (if (focused) FOCUS_IN else FOCUS_OUT).toByteArray(Charsets.US_ASCII)

  companion object {
    /** DECSET 1004: send focus-in and focus-out reports. */
    const val FOCUS_MODE = 1004
    const val FOCUS_IN = "\u001b[I"
    const val FOCUS_OUT = "\u001b[O"
  }
}
