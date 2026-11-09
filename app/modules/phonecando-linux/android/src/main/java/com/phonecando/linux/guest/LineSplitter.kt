package com.phonecando.linux.guest

import java.io.ByteArrayOutputStream

/**
 * Cuts a program's output into lines: `\n`, `\r\n` and a lone `\r` (a
 * progress bar drawn over itself) each end one, and blank lines are
 * dropped. A line past [maxBytes] keeps its start; the rest is dropped.
 * Each line is decoded as UTF-8. Pure.
 */
internal class LineSplitter(private val maxBytes: Int = MAX_LINE_BYTES, private val onLine: (String) -> Unit) {
  private val line = ByteArrayOutputStream()

  fun feed(bytes: ByteArray, count: Int) {
    for (i in 0 until count) {
      val b = bytes[i]
      if (b == LF || b == CR) {
        emit()
      } else if (line.size() < maxBytes) {
        line.write(b.toInt())
      }
    }
  }

  /** The last line, when the output did not end with a line break. */
  fun finish() = emit()

  private fun emit() {
    if (line.size() == 0) return
    val text = line.toString(Charsets.UTF_8.name())
    line.reset()
    if (text.isNotBlank()) onLine(text)
  }

  companion object {
    const val MAX_LINE_BYTES = 4096
    private const val LF = '\n'.code.toByte()
    private const val CR = '\r'.code.toByte()
  }
}
