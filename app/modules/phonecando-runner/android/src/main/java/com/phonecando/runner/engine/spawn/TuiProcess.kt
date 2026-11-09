package com.phonecando.runner.engine.spawn

import android.system.OsConstants
import com.phonecando.runner.engine.proc.EngineProcess
import com.phonecando.runner.engine.tui.EngineTerminal
import com.phonecando.terminal.host.HostedPty

/** A TUI engine's program on its PTY; [terminal] has its output and its end. */
internal class TuiProcess(private val pty: HostedPty, val terminal: EngineTerminal) : EngineProcess {
  override val isAlive: Boolean get() = pty.isAlive

  // A hang-up, as closing a terminal window: SIGHUP to its group, SIGKILL later (PtyHost).
  override fun terminate() = pty.close()

  override fun kill() = pty.signalGroup(OsConstants.SIGKILL)

  override fun exitStatus(): Int? = terminal.exitStatus

  override fun waitFor(): Int = terminal.awaitExit()

  override fun outputTail(max: Int): Pair<ByteArray, Boolean> = terminal.tail(max)
}
