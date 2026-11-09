package com.phonecando.runner.engine

import com.phonecando.agents.kit.render.ManifestKind
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.URL

// One sign-in for an agent's web UI (the module's pairWebUi): the kind's pair
// request with the agent's password, then the one-time URL its answer gives
// (ManifestKind.pairRequest, pairUrlFrom). A fresh URL every time: the code
// is single-use and short-lived. A 401 retries once with the address and
// password read again. The messages are the ones the app shows ("serve 500 on
// /api/pair"). Blocking; call it off the main thread.
internal object WebPairing {
  /** Where the agent's engine answers now, read for every attempt. */
  class Address(val port: String, val password: String)

  fun pair(kind: ManifestKind, address: () -> Address): String {
    var retried = false
    while (true) {
      val at = address()
      val request = kind.pairRequest(at.port, at.password)
        ?: throw IllegalStateException("${kind.displayName} has no web UI to sign in to")
      val path = URL(request.url).path
      val conn = request.open(TIMEOUT_MS, TIMEOUT_MS)
      try {
        if (request.method != "GET") {
          // An empty body, sent as such.
          conn.doOutput = true
          conn.setFixedLengthStreamingMode(0)
          conn.outputStream.close()
        }
        val status = conn.responseCode
        if (status == 401 && !retried) {
          retried = true
          continue
        }
        if (status !in 200..299) throw IOException("serve $status on $path")
        return kind.pairUrlFrom(conn.inputStream.bufferedReader().use { it.readText() }, at.port)
      } catch (_: SocketTimeoutException) {
        throw IOException("serve timeout on $path")
      } finally {
        conn.disconnect()
      }
    }
  }

  private const val TIMEOUT_MS = 8_000
}
