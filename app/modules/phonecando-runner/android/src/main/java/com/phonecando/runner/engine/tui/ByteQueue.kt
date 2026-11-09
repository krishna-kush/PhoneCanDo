package com.phonecando.runner.engine.tui

// Bytes waiting for a viewer, oldest first, taken in reads of any size.
// Pure; not thread-safe (EngineTerminal locks).
internal class ByteQueue {
  private val parts = ArrayDeque<ByteArray>()
  private var head = 0

  /** Bytes queued. */
  var size = 0
    private set

  fun add(bytes: ByteArray) {
    if (bytes.isEmpty()) return
    parts.addLast(bytes)
    size += bytes.size
  }

  /** Up to [max] bytes, or null when none are queued. */
  fun take(max: Int): ByteArray? {
    if (size == 0 || max <= 0) return null
    val out = ByteArray(minOf(max, size))
    var at = 0
    while (at < out.size) {
      val part = parts.first()
      val n = minOf(part.size - head, out.size - at)
      part.copyInto(out, at, head, head + n)
      at += n
      head += n
      if (head == part.size) {
        parts.removeFirst()
        head = 0
      }
    }
    size -= out.size
    return out
  }

  fun clear() {
    parts.clear()
    head = 0
    size = 0
  }
}
