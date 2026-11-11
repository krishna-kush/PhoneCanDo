package com.phonecando.runner.engine.tui

import com.phonecando.agents.kit.term.TermTheme
import java.util.Collections
import java.util.WeakHashMap

// The app's terminal theme, process-wide: JS sets it at start and on every
// change of scheme (engineTerminalTheme). A TUI engine starts with it
// (COLORFGBG, EngineEnv.terminal) and its terminal answers from it; a
// change reaches every live terminal, so a program that asked for theme
// reports (DEC mode 2031) hears it at once. Null until JS sets it: no
// COLORFGBG, no colour answers. Thread-safe.
internal object TerminalThemes {
  private val lock = Any()
  private val terminals = Collections.newSetFromMap(WeakHashMap<EngineTerminal, Boolean>())

  @Volatile var current: TermTheme? = null
    private set

  /** [terminal] answers from the current theme, now and after every change. Before its program starts, so its first query is answered. */
  fun follow(terminal: EngineTerminal) {
    synchronized(lock) {
      terminals += terminal
      current?.let(terminal::theme)
    }
  }

  fun set(theme: TermTheme) {
    val targets = synchronized(lock) {
      current = theme
      terminals.toList()
    }
    // Outside the lock: a terminal's answer may block on a full PTY for a second.
    for (t in targets) t.theme(theme)
  }
}
