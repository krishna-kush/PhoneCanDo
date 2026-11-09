package com.phonecando.linux.guest

import java.io.ByteArrayOutputStream
import java.io.InputStream

/**
 * The first [maxBytes] of a stream, as UTF-8 text (a character the cut
 * splits is dropped). [readFrom] stops reading at the cap; the caller
 * drains the rest. Synchronized: a pump thread fills it.
 */
internal class CappedText(private val maxBytes: Int) {
  private val bytes = ByteArrayOutputStream()

  fun readFrom(stream: InputStream) {
    val buf = ByteArray(GuestProcess.BUFFER)
    while (true) {
      val room = synchronized(this) { maxBytes - bytes.size() }
      if (room <= 0) return
      val n = stream.read(buf, 0, minOf(buf.size, room))
      if (n < 0) return
      synchronized(this) { bytes.write(buf, 0, n) }
    }
  }

  @Synchronized
  fun text(): String {
    val raw = bytes.toByteArray()
    return String(raw, 0, utf8Boundary(raw), Charsets.UTF_8)
  }

  // Where the last whole UTF-8 character ends: a sequence the cap cut short is left out.
  private fun utf8Boundary(raw: ByteArray): Int {
    if (raw.size < maxBytes) return raw.size
    var start = raw.size - 1
    while (start > 0 && raw.size - start < 4 && (raw[start].toInt() and 0xC0) == 0x80) start--
    val lead = raw[start].toInt() and 0xFF
    val length = when {
      lead < 0x80 -> 1
      lead >= 0xF0 -> 4
      lead >= 0xE0 -> 3
      lead >= 0xC0 -> 2
      else -> 1
    }
    return if (start + length > raw.size) start else raw.size
  }
}
