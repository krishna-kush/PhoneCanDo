package com.phonecando.runner.models.chats

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.net.SocketTimeoutException
import kotlin.concurrent.thread

// One request through the go-between (ChatRelay), on its own connection:
// its head and whole body read, then sent on to the model server with
// `Connection: close` (HttpHead), and the server's answer passed back byte
// for byte as it streams, until the server closes. A request that runs
// the model and carries the server's key first takes the slot
// (ChatSwitch: its chat saved and loaded) and holds it until the answer
// ends; the client leaving, while it waits or while it streams, closes
// the server's side, which stops the server's work, and lets the slot go.
internal class RelayExchange(
  private val client: Socket,
  private val upstreamPort: Int,
  private val key: String,
  private val switch: ChatSwitch,
  /** Sockets to close when the go-between closes. */
  private val track: (Socket) -> Unit,
  private val untrack: (Socket) -> Unit,
) {
  fun run() {
    try {
      client.soTimeout = READ_TIMEOUT_MS
      val input = client.getInputStream()
      val out = client.getOutputStream()
      val head = readHead(input) ?: return reply(out, 400, "Bad Request")
      if (head.expectsContinue) {
        out.write("HTTP/1.1 100 Continue\r\n\r\n".toByteArray(Charsets.ISO_8859_1))
        out.flush()
      }
      val body = when (val read = readBody(input, head)) {
        is Body.Bad -> return reply(out, read.status, read.reason)
        is Body.Read -> read.bytes
      }
      val api = ChatKeys.api(head.method, head.path)
      if (api == null || !head.carries(key)) return forward(head, body, input, out)
      val chat = ChatKeys.key(api, String(body ?: ByteArray(0), Charsets.UTF_8))
      if (!switch.acquire { gone(input) }) return
      try {
        try {
          switch.switchTo(chat)
        } catch (_: RuntimeException) {
          // Saving or loading went wrong in a way we did not foresee: the request still runs, read in full.
        }
        forward(head, body, input, out)
      } finally {
        switch.release()
      }
    } catch (_: IOException) {
      // The client or the server went away: nothing to answer.
    } finally {
      closeQuietly(client)
    }
  }

  // Sends the request on and passes the answer back until the server closes; the client leaving closes the server's side.
  private fun forward(head: HttpHead, body: ByteArray?, input: InputStream, out: OutputStream) {
    val upstream = Socket()
    track(upstream)
    try {
      try {
        upstream.connect(InetSocketAddress(HOST, upstreamPort), CONNECT_MS)
      } catch (_: IOException) {
        return reply(out, 502, "Bad Gateway")
      }
      // A prompt may take minutes before the first byte comes back.
      upstream.soTimeout = 0
      val up = upstream.getOutputStream()
      up.write(head.upstream(body?.size?.toLong()))
      if (body != null) up.write(body)
      up.flush()
      client.soTimeout = 0
      val watch = thread(name = "phonecando-relay-watch", isDaemon = true) {
        // Nothing more comes from a client that sent its whole request: a read ends only when it leaves.
        try {
          while (input.read() >= 0) Unit
        } catch (_: IOException) {
        }
        closeQuietly(upstream)
      }
      val down = upstream.getInputStream()
      val buffer = ByteArray(BUFFER)
      try {
        while (true) {
          val n = down.read(buffer)
          if (n < 0) break
          out.write(buffer, 0, n)
          out.flush()
        }
      } catch (_: IOException) {
        // Either side closed.
      }
      closeQuietly(client)
      watch.join(JOIN_MS)
    } finally {
      closeQuietly(upstream)
      untrack(upstream)
    }
  }

  // While waiting for the slot: has the client left? A read that times out at once says it is still there.
  private fun gone(input: InputStream): Boolean = try {
    client.soTimeout = 1
    input.read() < 0
  } catch (_: SocketTimeoutException) {
    false
  } catch (_: IOException) {
    true
  } finally {
    try {
      client.soTimeout = READ_TIMEOUT_MS
    } catch (_: IOException) {
    }
  }

  private fun readHead(input: InputStream): HttpHead? {
    val bytes = ByteArrayOutputStream()
    var matched = 0
    while (matched < 4) {
      val b = input.read()
      if (b < 0) return null
      bytes.write(b)
      if (bytes.size() > HttpHead.MAX_BYTES) return null
      matched = when {
        b == END[matched].code -> matched + 1
        b == '\r'.code -> 1
        else -> 0
      }
    }
    return HttpHead.parse(bytes.toString(Charsets.ISO_8859_1.name()))
  }

  private sealed interface Body {
    class Read(val bytes: ByteArray?) : Body
    class Bad(val status: Int, val reason: String) : Body
  }

  // The whole body: by its length, or its chunks put together; none for a request without one.
  private fun readBody(input: InputStream, head: HttpHead): Body {
    if (head.chunked) return readChunked(input)
    val length = head.contentLength ?: return Body.Read(null)
    if (length < 0) return Body.Bad(400, "Bad Request")
    if (length > MAX_BODY) return Body.Bad(413, "Payload Too Large")
    return Body.Read(readExactly(input, length.toInt()))
  }

  private fun readChunked(input: InputStream): Body {
    val body = ByteArrayOutputStream()
    while (true) {
      val line = readLine(input) ?: throw IOException("chunked body cut short")
      val size = line.substringBefore(';').trim().toLongOrNull(16) ?: return Body.Bad(400, "Bad Request")
      if (size < 0 || body.size() + size > MAX_BODY) return Body.Bad(413, "Payload Too Large")
      if (size == 0L) {
        // Trailers, up to the blank line.
        while (readLine(input)?.isNotEmpty() == true) Unit
        return Body.Read(body.toByteArray())
      }
      body.write(readExactly(input, size.toInt()))
      readLine(input)
    }
  }

  private fun readLine(input: InputStream): String? {
    val line = StringBuilder()
    while (true) {
      val b = input.read()
      if (b < 0) return null
      if (b == '\n'.code) return line.toString().trimEnd('\r')
      if (line.length > HttpHead.MAX_BYTES) throw IOException("line too long")
      line.append(b.toChar())
    }
  }

  private fun readExactly(input: InputStream, length: Int): ByteArray {
    val bytes = ByteArray(length)
    var at = 0
    while (at < length) {
      val n = input.read(bytes, at, length - at)
      if (n < 0) throw IOException("body cut short")
      at += n
    }
    return bytes
  }

  private fun reply(out: OutputStream, status: Int, reason: String) {
    try {
      out.write("HTTP/1.1 $status $reason\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".toByteArray(Charsets.ISO_8859_1))
      out.flush()
    } catch (_: IOException) {
    }
  }

  companion object {
    const val HOST = "127.0.0.1"

    /** The most a request's body may take: an agent's whole chat, images included. */
    const val MAX_BODY = 64L shl 20

    private const val END = "\r\n\r\n"
    private const val READ_TIMEOUT_MS = 30_000
    private const val CONNECT_MS = 5_000
    private const val BUFFER = 16 * 1024
    private const val JOIN_MS = 1_000L

    fun closeQuietly(socket: Socket) {
      try {
        socket.close()
      } catch (_: IOException) {
      }
    }
  }
}
