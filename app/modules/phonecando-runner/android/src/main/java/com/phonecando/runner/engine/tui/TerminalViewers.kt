package com.phonecando.runner.engine.tui

import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

// The viewers of the TUI engines' terminals, by id: what the
// engineTerminal* functions name. An id stays known until its terminal
// says it is replaced (detached) or done (ended), or it detaches; the next
// attach also forgets every id that was replaced meanwhile, so a JS reload
// that never read again keeps no terminal alive. An unknown id reads as
// detached; its writes and resizes do nothing. Thread-safe.
internal class TerminalViewers {
  data class Attached(val viewerId: String, val rows: Int, val cols: Int)

  private val terminals = ConcurrentHashMap<String, EngineTerminal>()
  private val next = AtomicLong()

  fun attach(terminal: EngineTerminal): Attached {
    val id = "v${next.incrementAndGet()}"
    val size = terminal.attach(id)
    terminals[id] = terminal
    terminals.entries.removeIf { (other, t) -> !t.holds(other) }
    return Attached(id, size.rows, size.cols)
  }

  fun read(viewerId: String, max: Int): ByteArray? {
    val terminal = terminals[viewerId]
      ?: throw TerminalViewException(TerminalViewException.DETACHED, "no such view")
    try {
      return terminal.read(viewerId, max)
    } catch (e: TerminalViewException) {
      terminals.remove(viewerId)
      throw e
    }
  }

  fun write(viewerId: String, bytes: ByteArray) {
    terminals[viewerId]?.write(viewerId, bytes)
  }

  fun resize(viewerId: String, rows: Int, cols: Int) {
    terminals[viewerId]?.resize(viewerId, rows, cols)
  }

  fun focus(viewerId: String, shown: Boolean) {
    terminals[viewerId]?.focus(viewerId, shown)
  }

  fun detach(viewerId: String) {
    terminals.remove(viewerId)?.detach(viewerId)
  }
}
