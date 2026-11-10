package com.phonecando.runner.engine.tui

import com.phonecando.agents.kit.term.ScreenRing
import com.phonecando.agents.kit.term.Signal
import com.phonecando.agents.kit.term.TermReplies
import com.phonecando.terminal.host.HostedPty
import com.phonecando.terminal.host.PtySink
import java.util.concurrent.CountDownLatch

// One TUI engine's terminal. Its PTY's output always drains here, on the
// PTY's reader thread, whether or not anyone watches: into the ScreenRing
// (the screen a late viewer gets back), to the signal listener (the
// engine's events and chat title) and, while one is attached, to the
// viewer's queue. One viewer at a time: an attach replaces the last one,
// and starts with the ring's replay (the state prologue, then the ring);
// a queue that outgrows [queueCap] while nobody reads is replaced by a
// fresh replay. Every call names its viewer: a read by a viewer that was
// replaced fails (detached), and once the program has ended and its last
// output is read, every read does (ended); a write or resize by a viewer
// that is not the current one, or after the end, does nothing. Writes and
// resizes run outside the lock: a write may block up to a second while the
// program does not read, and output must keep draining meanwhile.
// It also answers the program as a terminal would (kit-term TermReplies):
// the Program Status Protocol's support query, and focus reports while the
// program asked for them. The terminal is focused while its viewer says it
// shows the program (focus), so with no viewer, or one off screen, it is
// not: a TUI that notifies only while unfocused does so whenever nobody
// looks. Answers due before the PTY is bound go out at bind.
// Pure apart from the HostedPty it is bound to.
internal class EngineTerminal(
  rows: Int,
  cols: Int,
  private val clock: () -> Long = System::currentTimeMillis,
  private val ring: ScreenRing = ScreenRing(),
  private val queueCap: Int = QUEUE_CAP,
) : PtySink {
  data class Size(val rows: Int, val cols: Int)

  private val lock = Any()
  private val exited = CountDownLatch(1)
  private var size = Size(rows, cols)
  private var viewer: String? = null
  private val queue = ByteQueue()
  private var ended = false

  // The answers' state and their writes, in the order they were decided;
  // taken before [lock], never inside it.
  private val answerLock = Any()
  private val replies = TermReplies()
  private var unsent = ByteArray(0)

  @Volatile private var pty: HostedPty? = null

  @Volatile private var listener: ((List<Signal>) -> Unit)? = null

  /** Epoch ms of the last output; null before the first. */
  @Volatile var lastOutputAt: Long? = null
    private set

  /** The window title the program last set (OSC 0/2); null before it set one. */
  @Volatile var windowTitle: String? = null
    private set

  /** The program's exit status (PtySink.onExit) once it has ended. */
  @Volatile var exitStatus: Int? = null
    private set

  /** The PTY the program runs on, once it started. */
  fun bind(pty: HostedPty) {
    synchronized(answerLock) {
      this.pty = pty
      val due = unsent
      unsent = ByteArray(0)
      answer(due)
    }
  }

  /** Gets the signals in the output from now on, on the reader thread; null stops. */
  fun listen(listener: ((List<Signal>) -> Unit)?) {
    this.listener = listener
  }

  override fun onOutput(bytes: ByteArray, len: Int) {
    var signals: ArrayList<Signal>? = null
    synchronized(lock) {
      ring.append(bytes, 0, len) { (signals ?: ArrayList<Signal>().also { signals = it }) += it }
      if (viewer != null) {
        if (queue.size + len > queueCap) {
          queue.clear()
          queue.add(ring.replay())
        } else {
          queue.add(bytes.copyOf(len))
        }
      }
    }
    lastOutputAt = clock()
    signals?.let { list ->
      synchronized(answerLock) { for (s in list) answer(replies.onSignal(s)) }
      list.lastOrNull { it is Signal.Title }?.let { windowTitle = (it as Signal.Title).text }
      // A listener's failure must not end the reader: that would hang the program up.
      try {
        listener?.invoke(list)
      } catch (_: RuntimeException) {
      }
    }
  }

  override fun onExit(status: Int) {
    synchronized(lock) { ended = true }
    exitStatus = status
    exited.countDown()
  }

  /** Blocks until the program has ended; its exit status. */
  fun awaitExit(): Int {
    exited.await()
    return exitStatus ?: -1
  }

  /** The last [max] bytes of the ring, and whether output before them is missing. */
  fun tail(max: Int): Pair<ByteArray, Boolean> = synchronized(lock) { ring.tail(max) }

  /** [viewerId] becomes the viewer, replacing any other; its reads start with the replay. The focus stays until it says (focus). */
  fun attach(viewerId: String): Size = synchronized(lock) {
    if (ended) throw TerminalViewException(TerminalViewException.NOT_RUNNING, "the engine has ended")
    viewer = viewerId
    queue.clear()
    queue.add(ring.replay())
    size
  }

  /** Up to [max] bytes for [viewerId], or null when nothing is pending. */
  fun read(viewerId: String, max: Int): ByteArray? = synchronized(lock) {
    if (viewer != viewerId) throw TerminalViewException(TerminalViewException.DETACHED, "another view took this terminal over")
    queue.take(max) ?: if (ended) throw TerminalViewException(TerminalViewException.ENDED, "the engine has ended") else null
  }

  fun write(viewerId: String, bytes: ByteArray) {
    val target = synchronized(lock) {
      if (viewer != viewerId || ended) return
      pty
    }
    target?.write(bytes)
  }

  /** Same size again still makes the program repaint (SIGWINCH). */
  fun resize(viewerId: String, rows: Int, cols: Int) {
    val target = synchronized(lock) {
      if (viewer != viewerId || ended) return
      size = Size(rows, cols)
      pty
    }
    try {
      target?.resize(rows, cols)
    } catch (_: java.io.IOException) {
      // The PTY is going away; its end reaches the viewer as ended.
    }
  }

  /** Whether [viewerId] shows the program now; from a viewer that is not the current one, or after the end, nothing. */
  fun focus(viewerId: String, shown: Boolean) {
    synchronized(answerLock) {
      if (!holds(viewerId)) return
      answer(replies.focus(shown))
    }
  }

  /** The engine keeps running, unfocused; a viewer that was already replaced changes nothing. */
  fun detach(viewerId: String) {
    synchronized(answerLock) {
      synchronized(lock) {
        if (viewer != viewerId) return
        viewer = null
        queue.clear()
      }
      answer(replies.focus(false))
    }
  }

  /** Whether [viewerId] is the viewer (still so after the end, until it detaches). */
  fun holds(viewerId: String): Boolean = synchronized(lock) { viewer == viewerId }

  // Writes what the terminal answers, under answerLock; kept for bind()
  // before the PTY is bound, dropped once the program has ended. A failed
  // write must not end the reader that may be making it.
  private fun answer(bytes: ByteArray?) {
    if (bytes == null || bytes.isEmpty() || synchronized(lock) { ended }) return
    val target = pty
    if (target == null) {
      unsent += bytes
      return
    }
    try {
      target.write(bytes)
    } catch (_: java.io.IOException) {
    }
  }

  companion object {
    // A paused viewer's backlog; past it, a fresh replay says the same in less.
    const val QUEUE_CAP = 2 * ScreenRing.CAPACITY
  }
}
