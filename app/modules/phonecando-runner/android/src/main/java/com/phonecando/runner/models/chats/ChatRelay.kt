package com.phonecando.runner.models.chats

import java.io.IOException
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.Collections
import kotlin.concurrent.thread

// The go-between in front of one model server, on a loopback port of its
// own: agents get its URL in place of the server's, with the same key.
// Every request and its streamed answer pass through unchanged, for every
// wire API and route (RelayExchange); the requests that run the model take
// the server's one slot in turn, each chat saved to storage before another
// takes it and loaded back when it returns (ChatSwitch, ChatFiles), so
// chats that take turns are not read again from the start. Only loopback
// can reach it; the slot is switched only for a request that carries the
// server's key (the server checks every request's key itself).
internal class ChatRelay(
  private val upstreamPort: Int,
  private val key: String,
  val switch: ChatSwitch,
) {
  private val sockets: MutableSet<Socket> = Collections.synchronizedSet(HashSet())
  private var server: ServerSocket? = null

  @Volatile private var closed = false

  /** Its port once [start]ed. */
  val port: Int get() = checkNotNull(server) { "not started" }.localPort

  /** Listens on 127.0.0.1:[port] (0: any free one). @throws IOException when it cannot. */
  fun start(port: Int): ChatRelay {
    val s = ServerSocket()
    s.reuseAddress = true
    s.bind(InetSocketAddress(InetAddress.getByName(RelayExchange.HOST), port))
    server = s
    thread(name = "phonecando-relay", isDaemon = true) { accept(s) }
    return this
  }

  /** Stops listening and ends every exchange (their server sides close, which stops the server's work). */
  fun close() {
    closed = true
    try {
      server?.close()
    } catch (_: IOException) {
    }
    synchronized(sockets) { sockets.toList() }.forEach(RelayExchange::closeQuietly)
  }

  private fun accept(s: ServerSocket) {
    while (!closed) {
      val client = try {
        s.accept()
      } catch (_: IOException) {
        break
      }
      sockets += client
      if (closed) RelayExchange.closeQuietly(client)
      thread(name = "phonecando-relay-exchange", isDaemon = true) {
        try {
          RelayExchange(client, upstreamPort, key, switch, sockets::add, sockets::remove).run()
        } finally {
          sockets -= client
        }
      }
    }
  }
}
