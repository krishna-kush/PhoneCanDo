package com.phonecando.terminal.host

import android.system.OsConstants
import com.phonecando.terminal.PhoneCanDoPty
import com.phonecando.terminal.PtyExit
import com.phonecando.terminal.SpawnedPty
import kotlin.concurrent.thread

// One hosted PTY. Its reader thread owns the master fd: it waits on it,
// reads it, and alone closes it once its loop is over. Once closed, the
// kernel may hand that number to any other open() in our process, so writes
// and resizes take fdLock and check the master is still open.
internal class HostedSession(pty: SpawnedPty, private val sink: PtySink) : HostedPty {
  private val fd = pty.fd
  private val child = pty.child
  private val fdLock = Any()
  private var masterOpen = true // guarded by fdLock

  @Volatile
  private var hangUpAsked = false

  override val pid: Int = child.pid

  override val isAlive: Boolean
    get() = child.exit == null

  override fun write(bytes: ByteArray) {
    synchronized(fdLock) {
      if (masterOpen) PhoneCanDoPty.writePty(fd, bytes, bytes.size)
    }
  }

  override fun resize(rows: Int, cols: Int) {
    synchronized(fdLock) {
      if (masterOpen) PhoneCanDoPty.setWinSize(fd, rows, cols)
    }
  }

  override fun signalGroup(signal: Int) {
    child.kill(signal)
  }

  override fun close() {
    hangUpAsked = true
  }

  fun start() {
    thread(isDaemon = true, name = "pty-host-$pid") {
      try {
        pump()
      } finally {
        end()
      }
    }
  }

  // Hands output to the sink until the child side closes (EIO), a hang-up
  // is asked, or the program has exited and nothing more came for a poll
  // period (something it left behind may still hold the terminal).
  private fun pump() {
    val buf = ByteArray(READ_BYTES)
    while (!hangUpAsked) {
      when (PhoneCanDoPty.waitReadable(fd, POLL_MS)) {
        0 -> if (child.exit != null) return
        1 -> {
          val n = PhoneCanDoPty.readPty(fd, buf, buf.size)
          if (n < 0) return
          if (n > 0) sink.onOutput(buf, n)
        }
        else -> return
      }
    }
  }

  // Closes the master (the kernel hangs up the session) and sees the program
  // end. Unless a hang-up was asked, it gets one grace period to exit by
  // itself (its terminal can close just before it exits), then SIGHUP goes
  // to the group, and SIGKILL after another grace period.
  private fun end() {
    synchronized(fdLock) {
      PhoneCanDoPty.closePty(fd)
      masterOpen = false
    }
    val exit = child.await(if (hangUpAsked) 0 else GRACE_MS)
      ?: run {
        child.kill(OsConstants.SIGHUP)
        child.await(GRACE_MS)
      }
      ?: run {
        child.kill(OsConstants.SIGKILL)
        child.await()
      }
    sink.onExit(exit.status())
  }

  private companion object {
    const val READ_BYTES = 16 * 1024
    // The reader's longest sleep, so also the longest a close() takes to act.
    const val POLL_MS = 200
    // As the runner's ProcessReaper.
    const val GRACE_MS = 3_000L
  }
}

// The shell's convention: the exit code, or 128 + the signal.
private fun PtyExit.status(): Int = code ?: signal?.let { 128 + it } ?: -1
