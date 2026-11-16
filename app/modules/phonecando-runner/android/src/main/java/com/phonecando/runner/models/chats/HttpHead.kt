package com.phonecando.runner.models.chats

// An HTTP/1.1 request's head as the go-between reads it: the request
// line and the headers in order, unchanged. What goes on to the model
// server is the same head with the whole body's length (a chunked body is
// sent whole), no `Expect` (we answered it), and `Connection: close`, so
// the server ends the answer by closing and every request has its own
// connection. Pure.
internal class HttpHead(val method: String, val target: String, val version: String, val headers: List<Pair<String, String>>) {
  /** The target without its query. */
  val path: String get() = target.substringBefore('?')

  /** The first value of header [name], any case. */
  fun header(name: String): String? = headers.firstOrNull { it.first.equals(name, ignoreCase = true) }?.second

  /** The body's declared length; null when there is none, -1 when it is not a number. */
  val contentLength: Long? get() = header("Content-Length")?.let { it.trim().toLongOrNull() ?: -1 }

  val chunked: Boolean get() = header("Transfer-Encoding")?.contains("chunked", ignoreCase = true) == true

  val expectsContinue: Boolean get() = header("Expect")?.equals("100-continue", ignoreCase = true) == true

  /** Whether it carries [key] as the server wants it: `Authorization: Bearer <key>` or `x-api-key: <key>`. */
  fun carries(key: String): Boolean =
    header("Authorization")?.trim() == "Bearer $key" || header("x-api-key")?.trim() == key

  /** The head to send on with a body of [bodyLength] bytes (null: none). */
  fun upstream(bodyLength: Long?): ByteArray {
    val out = StringBuilder("$method $target $version\r\n")
    for ((name, value) in headers) {
      if (DROPPED.any { it.equals(name, ignoreCase = true) }) continue
      out.append(name).append(": ").append(value).append("\r\n")
    }
    if (bodyLength != null) out.append("Content-Length: ").append(bodyLength).append("\r\n")
    out.append("Connection: close\r\n\r\n")
    return out.toString().toByteArray(Charsets.ISO_8859_1)
  }

  companion object {
    /** The most a head may take, request line and headers. */
    const val MAX_BYTES = 64 * 1024

    private val DROPPED = listOf("Connection", "Keep-Alive", "Expect", "Content-Length", "Transfer-Encoding", "Proxy-Connection")

    /** [text] (the bytes up to the blank line, as ISO-8859-1) as a head; null when it is not one. */
    fun parse(text: String): HttpHead? {
      val lines = text.split("\r\n").dropLastWhile { it.isEmpty() }
      val request = lines.firstOrNull()?.split(' ') ?: return null
      if (request.size != 3 || request.any { it.isEmpty() } || !request[2].startsWith("HTTP/1.")) return null
      val headers = ArrayList<Pair<String, String>>()
      for (line in lines.drop(1)) {
        val colon = line.indexOf(':')
        if (colon <= 0 || line[0] == ' ' || line[0] == '\t') return null
        headers += line.substring(0, colon).trim() to line.substring(colon + 1).trim()
      }
      return HttpHead(request[0], request[1], request[2], headers)
    }
  }
}
