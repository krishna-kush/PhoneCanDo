package com.phonecando.agents.kit

import java.net.HttpURLConnection
import java.net.URL

/**
 * Which of a server kind's inbox calls (the manifest's `inbox.server`):
 * [DELIVER] queues other agents' messages for the agent's chat while it
 * works, or when it may not be woken; [WAKE] posts them to an idle agent
 * that may be, starting its turn.
 */
enum class InboxCall { DELIVER, WAKE }

/**
 * One loopback request that hands other agents' messages to an engine: its
 * URL, headers (the kind's auth and the JSON content type), method and JSON
 * body. [toString] leaves out the headers and the body: the one holds the
 * password, the other what the agents wrote.
 */
data class InboxRequest(val url: String, val headers: Map<String, String>, val method: String, val body: String) {
  /** Sends it and returns the HTTP status; throws when the engine cannot be reached. */
  fun send(connectTimeoutMs: Int, readTimeoutMs: Int): Int = exchange(connectTimeoutMs, readTimeoutMs).first

  /**
   * Sends it (a GET carries no body) and returns the HTTP status with what
   * the engine answered (empty on an error status); throws when the engine
   * cannot be reached.
   */
  fun exchange(connectTimeoutMs: Int, readTimeoutMs: Int): Pair<Int, String> {
    val conn = URL(url).openConnection() as HttpURLConnection
    return try {
      conn.requestMethod = method
      conn.connectTimeout = connectTimeoutMs
      conn.readTimeout = readTimeoutMs
      conn.useCaches = false
      headers.forEach { (k, v) -> conn.setRequestProperty(k, v) }
      if (method != "GET") {
        conn.doOutput = true
        conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
      }
      val status = conn.responseCode
      // Read what the engine answered, so the connection can be reused.
      val answer = (if (status < 400) conn.inputStream else conn.errorStream)?.use { it.readBytes() }
      status to if (status < 400 && answer != null) answer.toString(Charsets.UTF_8) else ""
    } finally {
      conn.disconnect()
    }
  }

  override fun toString(): String = "InboxRequest($method $url)"
}
