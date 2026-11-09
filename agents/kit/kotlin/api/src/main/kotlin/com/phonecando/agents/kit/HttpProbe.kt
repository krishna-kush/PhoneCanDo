package com.phonecando.agents.kit

import java.net.HttpURLConnection
import java.net.URL

/** One loopback request to an engine: its URL, the headers it needs and its method. */
data class HttpProbe(val url: String, val headers: Map<String, String>, val method: String = "GET") {
  fun open(connectTimeoutMs: Int, readTimeoutMs: Int): HttpURLConnection {
    val conn = URL(url).openConnection() as HttpURLConnection
    conn.requestMethod = method
    conn.connectTimeout = connectTimeoutMs
    conn.readTimeout = readTimeoutMs
    conn.useCaches = false
    headers.forEach { (k, v) -> conn.setRequestProperty(k, v) }
    return conn
  }

  /** HTTP status of a bodiless request; throws when the engine cannot be reached. */
  fun status(connectTimeoutMs: Int, readTimeoutMs: Int): Int {
    val conn = open(connectTimeoutMs, readTimeoutMs)
    return try {
      conn.responseCode
    } finally {
      conn.disconnect()
    }
  }
}
