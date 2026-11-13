package com.phonecando.runner.models

import java.io.File
import java.io.IOException
import java.io.RandomAccessFile

/**
 * The end of a model's server log (ModelServer writes it afresh on every
 * start of that model's server), for the model's Server log page: at most
 * [READ_BYTES] of whole lines from the end, whether earlier lines were left
 * out, when it was last written (ms) and its [size] (the page re-reads it
 * while the model is loaded and draws again only when that moved).
 */
internal data class ModelServerLog(val text: String, val cut: Boolean, val modifiedAt: Long, val size: Long) {
  fun toMap(): Map<String, Any> = mapOf("text" to text, "cut" to cut, "modifiedAt" to modifiedAt, "size" to size)

  companion object {
    const val READ_BYTES = 128 * 1024

    /** [modelId]'s log in [logs] (ModelSlots.LOG_DIR); null when its server never ran or the log cannot be read. */
    fun read(logs: File, modelId: String, maxBytes: Int = READ_BYTES): ModelServerLog? {
      val file = File(logs, ModelServer.logName(modelId))
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
          val text = String(bytes, from, bytes.size - from, Charsets.UTF_8).trimEnd('\n')
          ModelServerLog(text, cut, file.lastModified(), size)
        }
      } catch (_: IOException) {
        null
      }
    }
  }
}
