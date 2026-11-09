package com.phonecando.agents.kit.term

// The recent output of one TUI, enough to redraw its screen for a viewer
// who attaches later: about [capacity] bytes, from the last full clear,
// reset or alternate-screen entry on (nothing before one can still show),
// or as much as fits. The bytes are kept in chunks that each begin between
// two sequences and two characters (SignalScanner.atBoundary) and know the
// terminal state (TermState) there, so the front is only ever cut there; when one
// sequence alone outgrows the ring, everything goes and keeping resumes at
// the next boundary. replay() is the state's prologue, then the bytes. Pure;
// not thread-safe (the owner locks).
class ScreenRing(private val capacity: Int = CAPACITY, private val chunkBytes: Int = CHUNK_BYTES) {
  private class Chunk(val state: TermState) {
    var data = ByteArray(INITIAL_CHUNK)
    var size = 0

    fun add(b: Byte) {
      if (size == data.size) data = data.copyOf(data.size * 2)
      data[size++] = b
    }
  }

  private val scanner = SignalScanner()
  private val state = TermState()
  private val chunks = ArrayDeque<Chunk>()
  private val starts = ArrayDeque<Long>()

  /** Bytes kept. */
  var size = 0
    private set

  /** Bytes let go so far: cut off at a clear, trimmed for room, or skipped. */
  var dropped = 0L
    private set

  /** Keeps [len] bytes of output from [off]; each Signal in them also goes to [onSignal], in order. */
  fun append(bytes: ByteArray, off: Int = 0, len: Int = bytes.size - off, onSignal: (Signal) -> Unit = {}) {
    for (i in off until off + len) {
      if (scanner.atBoundary && (chunks.isEmpty() || chunks.last().size >= chunkBytes)) {
        chunks.addLast(Chunk(state.copy()))
        starts.addLast(scanner.position)
      }
      val chunk = chunks.lastOrNull()
      if (chunk != null) {
        chunk.add(bytes[i])
        size++
      } else {
        dropped++
      }
      scanner.step(bytes[i]) { signal ->
        when (signal) {
          Signal.FullClear, Signal.Reset -> cutAt(scanner.sequenceStart)
          is Signal.AltScreen -> if (signal.enter) cutAt(scanner.sequenceStart)
          else -> {}
        }
        state.apply(signal)
        onSignal(signal)
      }
    }
    trim()
  }

  /** The prologue of the state at the start, then every byte kept. */
  fun replay(): ByteArray {
    val prologue = (chunks.firstOrNull()?.state ?: state).prologue()
    val out = ByteArray(prologue.size + size)
    prologue.copyInto(out)
    var at = prologue.size
    for (c in chunks) {
      c.data.copyInto(out, at, 0, c.size)
      at += c.size
    }
    return out
  }

  /** The last [max] bytes kept (no prologue), and whether output before them is missing. */
  fun tail(max: Int): Pair<ByteArray, Boolean> {
    val n = minOf(max, size)
    val out = ByteArray(n)
    var skip = size - n
    var at = 0
    for (c in chunks) {
      if (skip >= c.size) {
        skip -= c.size
        continue
      }
      c.data.copyInto(out, at, skip, c.size)
      at += c.size - skip
      skip = 0
    }
    return out to (dropped > 0 || n < size)
  }

  // The sequence that began at [start] makes everything before it unseen:
  // keep from there, with the state in effect before it. It lies in the
  // last chunk, which no boundary splits mid-sequence.
  private fun cutAt(start: Long) {
    val last = chunks.lastOrNull() ?: return
    val offset = (start - starts.last()).toInt().coerceIn(0, last.size)
    val kept = Chunk(state.copy())
    for (j in offset until last.size) kept.add(last.data[j])
    dropped += size - kept.size
    chunks.clear()
    starts.clear()
    chunks.addLast(kept)
    starts.addLast(start)
    size = kept.size
  }

  private fun trim() {
    while (size > capacity && chunks.size > 1) {
      val first = chunks.removeFirst()
      starts.removeFirst()
      size -= first.size
      dropped += first.size
    }
    if (size > capacity) {
      dropped += size
      size = 0
      chunks.clear()
      starts.clear()
    }
  }

  companion object {
    const val CAPACITY = 1 shl 20
    const val CHUNK_BYTES = 16 * 1024
    private const val INITIAL_CHUNK = 256
  }
}
