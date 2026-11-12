package com.phonecando.linux.guest

import java.io.File
import java.io.IOException
import java.io.RandomAccessFile

/**
 * The end of an image's last script log (ScriptLog: its `# <label>` line,
 * then what it printed, redacted), for the agent's Install page: at most
 * [READ_BYTES] of whole lines from the end, whether earlier lines were left
 * out, and when it was last written (ms), which is about when the script ended.
 */
data class ScriptLogEnd(val text: String, val cut: Boolean, val modifiedAt: Long) {
  fun toMap(): Map<String, Any> = mapOf("text" to text, "cut" to cut, "modifiedAt" to modifiedAt)

  companion object {
    const val READ_BYTES = 128 * 1024

    /** Null when the image has no log yet (no script ran there) or it cannot be read. */
    fun read(file: File, maxBytes: Int = READ_BYTES): ScriptLogEnd? {
      if (!file.isFile) return null
      return try {
        RandomAccessFile(file, "r").use { raf ->
          val size = raf.length()
          val cut = size > maxBytes
          val start = if (cut) size - maxBytes else 0L
          val bytes = ByteArray((size - start).toInt())
          raf.seek(start)
          raf.readFully(bytes)
          // A cut lands mid-line (maybe mid-character): start at the next whole line.
          val from = if (cut) bytes.indexOf('\n'.code.toByte()) + 1 else 0
          ScriptLogEnd(String(bytes, from, bytes.size - from, Charsets.UTF_8).trimEnd('\n'), cut, file.lastModified())
        }
      } catch (_: IOException) {
        null
      }
    }
  }
}
