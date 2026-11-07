package com.phonecando.runner.engine.proc

import android.system.ErrnoException
import android.system.Os
import android.system.OsConstants

/** Signals through Os.kill; a process that is already gone is not an error. */
object OsSignals : ProcessReaper.Signals {
  override fun term(pid: Int) = send(pid, OsConstants.SIGTERM)

  override fun kill(pid: Int) = send(pid, OsConstants.SIGKILL)

  private fun send(pid: Int, signal: Int) {
    try {
      Os.kill(pid, signal)
    } catch (_: ErrnoException) {
    }
  }

  /** A reaper over the real /proc for this process. */
  fun reaper(): ProcessReaper {
    val scanner = ProcScanner()
    val uid = android.os.Process.myUid()
    return ProcessReaper({ scanner.scan(uid) }, OsSignals, android.os.Process.myPid(), uid)
  }
}
