package com.phonecando.linux.guest

import java.io.Closeable
import java.io.File
import java.io.IOException
import java.io.Writer

/**
 * A guest script's log, `logs/install.log` in its image: started afresh for
 * every script with a `# <label>` line, then every (redacted) line it
 * prints, flushed as it comes so a kill keeps what was there. Stops at
 * [maxBytes] with one line saying so. A disk error ends the log, never the
 * script.
 */
internal class ScriptLog(file: File, label: String, private val maxBytes: Long = MAX_BYTES) : Closeable {
  private var out: Writer? = try {
    file.parentFile?.mkdirs()
    file.bufferedWriter(Charsets.UTF_8)
  } catch (_: IOException) {
    null
  }
  private var bytes = 0L

  init {
    line("# $label")
  }

  @Synchronized
  fun line(text: String) {
    val writer = out ?: return
    val size = text.toByteArray(Charsets.UTF_8).size + 1L
    try {
      if (bytes + size > maxBytes) {
        writer.write("[log cut at $maxBytes bytes]\n")
        close()
        return
      }
      writer.write(text)
      writer.write("\n")
      writer.flush()
      bytes += size
    } catch (_: IOException) {
      close()
    }
  }

  @Synchronized
  override fun close() {
    try {
      out?.close()
    } catch (_: IOException) {
      // What was flushed stays.
    }
    out = null
  }

  companion object {
    const val FILE_NAME = "install.log"
    const val MAX_BYTES = 8L * 1024 * 1024
  }
}
