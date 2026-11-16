package com.phonecando.runner.bridge

import java.io.IOException
import java.io.InputStream

// A request's body as the bridge reads it: exactly its Content-Length bytes
// (no more: the next request on the same connection follows them), decoded
// as UTF-8, which JSON always is (RFC 8259). NanoHTTPD's parseBody decodes
// a body whose Content-Type names no charset as US-ASCII, so each byte of
// an em dash, an emoji or an accented letter became U+FFFD, and our
// clients and MCP clients send `application/json` with none. An empty body
// is "{}". Pure.
object RequestBody {
  const val EMPTY = "{}"

  /** [length] bytes of [input] as text; throws IOException when the body ends before them. */
  fun read(input: InputStream, length: Long): String {
    if (length <= 0) return EMPTY
    require(length <= Int.MAX_VALUE) { "body of $length bytes" }
    val bytes = ByteArray(length.toInt())
    var read = 0
    while (read < bytes.size) {
      val n = input.read(bytes, read, bytes.size - read)
      if (n < 0) throw IOException("the body ended after $read of ${bytes.size} bytes")
      read += n
    }
    return String(bytes, Charsets.UTF_8).trim().ifEmpty { EMPTY }
  }
}
