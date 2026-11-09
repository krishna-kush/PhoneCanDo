package com.phonecando.terminal

import java.io.IOException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

/** How a PTY's program ended. Both null: it is gone but its status was not ours to read. */
internal data class PtyExit(val code: Int?, val signal: Int?)

// One program running on a PTY. A daemon thread waits for it to exit and
// then reaps exactly this pid (never waitpid(-1): that could steal exit
// statuses from Java's own process reaper). Reaping and kill share a lock,
// so a signal can never reach a pid the kernel has already recycled.
internal class PtyChild(val pid: Int) {
  private val lock = Any()
  private var reaped = false
  private val reapedLatch = CountDownLatch(1)

  /** Null while the program runs (or for the moment between its exit and our reap). */
  @Volatile
  var exit: PtyExit? = null
    private set

  init {
    thread(isDaemon = true, name = "pty-reaper-$pid") {
      try {
        PhoneCanDoPty.awaitExit(pid)
      } catch (_: IOException) {
        // Not waitable (already reaped elsewhere): reap below fails the same way.
      }
      synchronized(lock) {
        exit = try {
          val (code, signal) = PhoneCanDoPty.reap(pid)
          if (signal != 0) PtyExit(null, signal) else PtyExit(code, null)
        } catch (_: IOException) {
          PtyExit(null, null)
        }
        reaped = true
      }
      reapedLatch.countDown()
    }
  }

  /** Signals the program's whole process group; false once it has been reaped. */
  fun kill(signal: Int): Boolean = synchronized(lock) {
    if (reaped) return false
    PhoneCanDoPty.killGroup(pid, signal)
    true
  }

  /** Waits up to [timeoutMs] for the reap: the exit, or null while it still runs. */
  fun await(timeoutMs: Long): PtyExit? {
    reapedLatch.await(timeoutMs, TimeUnit.MILLISECONDS)
    return exit
  }

  /** Waits for the reap, however long it takes. */
  fun await(): PtyExit {
    reapedLatch.await()
    return checkNotNull(exit)
  }
}
