package com.phonecando.runner.engine.spawn

import com.phonecando.runner.engine.tui.EngineTerminal
import com.phonecando.runner.engine.tui.TerminalThemes
import com.phonecando.terminal.host.PtyHost
import com.phonecando.terminal.host.PtySpawnSpec
import java.io.File

// A TUI engine: the kind's program on a PTY that the process-wide PtyHost
// keeps, so it outlives the screen and a JS reload, in [cwd] with exactly
// the environment given. The tty starts sane (cooked, output processing
// on), as a terminal emulator gives it: a TUI switches to raw itself and
// keeps the output flags it found, so a raw start (-opost) loses every
// carriage return (device-checked with top). [handOver]: the program hands
// the terminal on (our Linux
// launcher, to the guest program). Its output drains into an
// EngineTerminal from the first byte, whether or not anyone watches, which
// answers from the app's terminal theme from that byte on (TerminalThemes).
internal object TuiSpawner {
  /** The size a TUI starts at; the first viewer resizes it. */
  const val ROWS = 24
  const val COLS = 80

  fun spawn(argv: List<String>, env: Map<String, String>, cwd: File, handOver: Boolean): TuiProcess {
    val terminal = EngineTerminal(ROWS, COLS)
    TerminalThemes.follow(terminal)
    val spec = PtySpawnSpec(argv, env.map { (k, v) -> "$k=$v" }, cwd.path, ROWS, COLS, raw = false, handOver = handOver)
    val pty = PtyHost.spawn(spec, terminal)
    terminal.bind(pty)
    return TuiProcess(pty, terminal)
  }
}
