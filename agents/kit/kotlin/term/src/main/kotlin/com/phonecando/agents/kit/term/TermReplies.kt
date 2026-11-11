package com.phonecando.agents.kit.term

// What a terminal writes back to its program, for a TUI that runs with or
// without anyone watching: the answer to the Program Status Protocol's
// support query (ProgramStatus.reply), and focus reports (CSI I in, CSI O
// out) while the program has asked for them (DEC private mode 1004, until
// it resets the mode or the terminal: RIS). The terminal starts unfocused
// (nobody shows a fresh TUI); focus() moves it. As xterm.js does, turning
// the mode on reports the focus at once, so a program that takes itself to
// be focused learns otherwise. Only a change of focus reports again.
// It also tells the program its theme (TermTheme): the colours it asks for
// (OSC 4 / 10 / 11 / 12), dark or light (CSI ? 996 n) and, while it asked
// for theme reports (DEC private mode 2031, until it resets the mode or the
// terminal), a report on every change of theme. With no theme (nobody set
// one yet) those queries go unanswered. Device attributes (as xterm.js
// answers them) and the operating status (OK) are always answered:
// programs send them after a colour query to learn that no more answers
// are coming. Pure; one per stream, not thread-safe (the owner locks).
class TermReplies {
  /** Whether the terminal counts as focused. */
  var focused = false
    private set

  /** Whether the program asked for focus reports. */
  var focusReports = false
    private set

  /** The theme it answers from; null until theme() sets one. */
  var theme: TermTheme? = null
    private set

  /** Whether the program asked for theme reports. */
  var themeReports = false
    private set

  /** What the terminal answers to [signal] in the program's output, or null. */
  fun onSignal(signal: Signal): ByteArray? = when (signal) {
    is Signal.StatusQuery -> ProgramStatus.reply(signal.bel)
    is Signal.Modes -> {
      if (THEME_MODE in signal.modes) themeReports = signal.set
      if (FOCUS_MODE in signal.modes) {
        focusReports = signal.set
        if (signal.set) report() else null
      } else {
        null
      }
    }
    Signal.Reset -> {
      focusReports = false
      themeReports = false
      null
    }
    is Signal.ColorQuery -> theme?.answer(signal)
    Signal.ThemeQuery -> theme?.report()
    Signal.DeviceAttributesQuery -> ascii(DEVICE_ATTRIBUTES)
    Signal.OperatingStatusQuery -> ascii(STATUS_OK)
    else -> null
  }

  /** The terminal gains or loses focus: the report that calls for, or null (no change, or no reports asked for). */
  fun focus(focused: Boolean): ByteArray? {
    if (this.focused == focused) return null
    this.focused = focused
    return if (focusReports) report() else null
  }

  /** The terminal's theme is now [theme]: its report when it changed and the program asked for them, else null. */
  fun theme(theme: TermTheme): ByteArray? {
    val changed = this.theme != theme
    this.theme = theme
    return if (changed && themeReports) theme.report() else null
  }

  private fun report() = ascii(if (focused) FOCUS_IN else FOCUS_OUT)

  private fun ascii(text: String) = text.toByteArray(Charsets.US_ASCII)

  companion object {
    /** DECSET 1004: send focus-in and focus-out reports. */
    const val FOCUS_MODE = 1004
    const val FOCUS_IN = "\u001b[I"
    const val FOCUS_OUT = "\u001b[O"

    /** DECSET 2031: send a theme report when the theme changes. */
    const val THEME_MODE = 2031

    /** What xterm.js answers to primary device attributes (a VT100 with advanced video). */
    const val DEVICE_ATTRIBUTES = "\u001b[?1;2c"
    const val STATUS_OK = "\u001b[0n"
  }
}
