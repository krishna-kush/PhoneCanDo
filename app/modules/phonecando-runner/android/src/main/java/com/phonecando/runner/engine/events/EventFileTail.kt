package com.phonecando.runner.engine.events

import com.phonecando.runner.engine.EventSource
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.RandomAccessFile

// Follows an agent's events file: every PERIOD_MS, the whole lines added
// since the last look, at most MAX_READ bytes a look. Each engine start
// empties the file (KitFiles.prepare), so we read it from its start; a file
// that got shorter was emptied again and is read from its start once more.
// A line longer than EventLine.MAX_BYTES is dropped whole (the kit scripts
// cut theirs), and a line whose newline has not come yet waits for the
// next look; bytes that are no UTF-8 read as replacement characters.
// poll() is the IO; tests drive it.
internal class EventFileTail(private val file: File, private val onLine: (String) -> Unit) {
  private var offset = 0L
  private val line = ByteArrayOutputStream()
  private var tooLong = false

  /** Reads what was added since the last call. */
  @Synchronized
  fun poll() {
    val length = file.length()
    if (length < offset) {
      offset = 0
      line.reset()
      tooLong = false
    }
    if (length == offset) return
    val chunk = ByteArray(minOf(length - offset, MAX_READ.toLong()).toInt())
    RandomAccessFile(file, "r").use {
      it.seek(offset)
      it.readFully(chunk)
    }
    offset += chunk.size
    for (b in chunk) {
      when {
        b == NEWLINE -> {
          if (!tooLong) onLine(line.toString(Charsets.UTF_8.name()))
          line.reset()
          tooLong = false
        }
        tooLong -> {}
        line.size() >= EventLine.MAX_BYTES -> {
          line.reset()
          tooLong = true
        }
        else -> line.write(b.toInt())
      }
    }
  }

  /** Polls every PERIOD_MS (EventTimers) until stopped. */
  fun start(): EventSource = EventTimers.every(PERIOD_MS, ::poll)

  companion object {
    const val PERIOD_MS = 500L
    const val MAX_READ = 64 * 1024
    private const val NEWLINE = '\n'.code.toByte()
  }
}
