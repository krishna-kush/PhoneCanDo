package com.phonecando.runner.engine

import com.phonecando.runner.agents.TestKinds
import fi.iki.elonen.NanoHTTPD
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Base64
import java.util.concurrent.CopyOnWriteArrayList

// JVM checks for WebPairing against a loopback server standing in for
// opencode serve: the request it sends, the URL it makes, and the one retry
// on 401 with the password read again.
class WebPairingTest {
  private val kind = checkNotNull(TestKinds.catalog.get("opencode"))

  private class Seen(val method: String, val uri: String, val auth: String?, val type: String?, val length: String?)

  private val seen = CopyOnWriteArrayList<Seen>()
  private val answers = ArrayDeque<Pair<Int, String>>()

  private val server = object : NanoHTTPD("127.0.0.1", 0) {
    override fun serve(session: IHTTPSession): Response {
      val h = session.headers
      seen += Seen(session.method.name, session.uri, h["authorization"], h["content-type"], h["content-length"])
      val (status, body) = synchronized(answers) { answers.removeFirstOrNull() } ?: (500 to "")
      return newFixedLengthResponse(Response.Status.lookup(status), "application/json", body)
    }
  }.apply { start(NanoHTTPD.SOCKET_READ_TIMEOUT, true) }

  private val port get() = server.listeningPort.toString()

  @After fun stop() {
    server.stop()
  }

  private fun basic(pw: String) = "Basic " + Base64.getEncoder().encodeToString("opencode:$pw".toByteArray())

  @Test fun postsAndBuildsTheSignInUrl() {
    answers += 200 to """{"data":{"code":"c 1","expires_in":300}}"""
    val url = WebPairing.pair(kind) { WebPairing.Address(port, "pw-1") }
    assertEquals("http://127.0.0.1:$port/auth/connect/c%201", url)
    val req = seen.single()
    assertEquals("POST", req.method)
    assertEquals("/api/pair", req.uri)
    assertEquals(basic("pw-1"), req.auth)
    assertEquals("application/json", req.type)
    assertEquals("0", req.length)
  }

  @Test fun a401RetriesOnceWithTheAddressReadAgain() {
    answers += 401 to ""
    answers += 200 to """{"code":"k"}"""
    var reads = 0
    val url = WebPairing.pair(kind) { WebPairing.Address(port, "pw-${++reads}") }
    assertEquals("http://127.0.0.1:$port/auth/connect/k", url)
    assertEquals(listOf(basic("pw-1"), basic("pw-2")), seen.map { it.auth })
  }

  @Test fun failuresSayWhatTheAppShows() {
    answers += 401 to ""
    answers += 401 to ""
    assertEquals("serve 401 on /api/pair", failure())
    answers += 500 to ""
    assertEquals("serve 500 on /api/pair", failure())
    answers += 200 to """{"data":{"code":""}}"""
    assertEquals("serve empty pairing code", failure())
    assertTrue(seen.all { it.uri == "/api/pair" })
  }

  private fun failure(): String? =
    runCatching { WebPairing.pair(kind) { WebPairing.Address(port, "pw") } }.exceptionOrNull()?.message
}
