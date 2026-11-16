package com.phonecando.runner.models.chats

import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketTimeoutException
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

// A stand-in for llama-server on loopback, enough for the go-between: its
// slot routes write and read files in [chats] (as the pinned server does
// with --slot-save-path), and a model route answers with a chunked SSE
// stream of [events] events, holding before the last one until [finish]
// opens (or for good, to be cancelled). Every request is recorded, and
// whether each model request's connection was closed under it.
internal class FakeLlamaServer(private val chats: File, private val key: String) {
  data class Request(val method: String, val target: String, val headers: Map<String, String>, val body: String)

  val requests: MutableList<Request> = Collections.synchronizedList(ArrayList())
  val cancelled = CountDownLatch(1)
  var finish = CountDownLatch(0)
  var events = 3
  var restoreOk = true
  private val socket = ServerSocket().apply { bind(InetSocketAddress(InetAddress.getByName("127.0.0.1"), 0)) }
  val port: Int get() = socket.localPort

  init {
    thread(isDaemon = true) {
      while (true) {
        val client = try {
          socket.accept()
        } catch (_: IOException) {
          break
        }
        thread(isDaemon = true) { serve(client) }
      }
    }
  }

  fun close() = socket.close()

  fun modelRequests(): List<Request> = synchronized(requests) { requests.filter { !it.target.startsWith("/slots") } }

  fun slotCalls(): List<String> = synchronized(requests) {
    requests.filter { it.target.startsWith("/slots") }.map { "${it.target.substringAfter("action=")} ${Regex("\"filename\":\"([^\"]+)\"").find(it.body)!!.groupValues[1]}" }
  }

  private fun serve(client: Socket) {
    client.use { c ->
      val input = c.getInputStream()
      val out = c.getOutputStream()
      val head = readHead(input) ?: return
      val lines = head.split("\r\n")
      val (method, target) = lines[0].split(' ')
      val headers = lines.drop(1).filter { it.contains(':') }.associate { it.substringBefore(':').lowercase() to it.substringAfter(':').trim() }
      val length = headers["content-length"]?.toInt() ?: 0
      val body = String(input.readNBytes(length), Charsets.UTF_8)
      val request = Request(method, target, headers, body)
      requests += request
      if (headers["authorization"] != "Bearer $key" && headers["x-api-key"] != key) {
        out.write("HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".toByteArray())
        return
      }
      when {
        target.startsWith("/slots/0?action=save") -> {
          File(chats, name(body)).writeBytes(ByteArray(16))
          json(out, """{"id_slot":0}""")
        }
        target.startsWith("/slots/0?action=restore") -> {
          if (restoreOk && File(chats, name(body)).isFile) json(out, """{"id_slot":0}""")
          else out.write("HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".toByteArray())
        }
        target == "/v1/models" -> json(out, """{"data":[{"id":"m"}]}""")
        else -> stream(c, out)
      }
    }
  }

  private fun stream(c: Socket, out: java.io.OutputStream) {
    try {
      out.write("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n".toByteArray())
      for (i in 1..events) {
        if (i == events) {
          // Held until [finish] opens; a read that ends says the go-between closed our side.
          c.soTimeout = 50
          while (!finish.await(50, TimeUnit.MILLISECONDS)) {
            val gone = try {
              c.getInputStream().read() < 0
            } catch (_: SocketTimeoutException) {
              false
            }
            if (gone) {
              cancelled.countDown()
              return
            }
          }
        }
        chunk(out, "data: {\"n\":$i}\n\n")
      }
      chunk(out, "")
    } catch (_: IOException) {
      cancelled.countDown()
    }
  }

  private fun chunk(out: java.io.OutputStream, text: String) {
    val bytes = text.toByteArray()
    out.write("${Integer.toHexString(bytes.size)}\r\n".toByteArray())
    out.write(bytes)
    out.write("\r\n".toByteArray())
    out.flush()
  }

  private fun json(out: java.io.OutputStream, text: String) {
    out.write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${text.length}\r\nConnection: close\r\n\r\n$text".toByteArray())
  }

  private fun name(body: String) = Regex("\"filename\":\"([^\"]+)\"").find(body)!!.groupValues[1]

  private fun readHead(input: InputStream): String? {
    val bytes = ByteArrayOutputStream()
    while (!bytes.toString(Charsets.ISO_8859_1.name()).endsWith("\r\n\r\n")) {
      val b = input.read()
      if (b < 0) return null
      bytes.write(b)
    }
    return bytes.toString(Charsets.ISO_8859_1.name()).removeSuffix("\r\n\r\n")
  }
}
