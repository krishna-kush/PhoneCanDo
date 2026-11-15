package com.phonecando.runner.engine.spawn

import java.io.File
import java.io.RandomAccessFile

/** The end of an engine's log file: at most [max] bytes, however long the file or its lines, and whether earlier bytes are left out; null when it cannot be read. */
internal object LogTail {
  fun read(file: File, max: Int): Pair<ByteArray, Boolean>? = try {
    RandomAccessFile(file, "r").use { f ->
      val len = f.length()
      val start = maxOf(0L, len - max)
      val window = ByteArray((len - start).toInt())
      f.seek(start)
      f.readFully(window)
      window to (start > 0)
    }
  } catch (_: Exception) {
    null
  }
}
