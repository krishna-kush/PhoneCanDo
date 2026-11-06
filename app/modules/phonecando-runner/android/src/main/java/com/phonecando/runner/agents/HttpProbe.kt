package com.phonecando.runner.agents

import java.net.HttpURLConnection
import java.net.URL

/** One loopback request to an engine: its URL and the headers it needs. */
data class HttpProbe(val url: String, val headers: Map<String, String>) {
  fun open(connectTimeoutMs: Int, readTimeoutMs: Int): HttpURLConnection {
    val conn = URL(url).openConnection() as HttpURLConnection
    conn.connectTimeout = connectTimeoutMs
    conn.readTimeout = readTimeoutMs
    conn.useCaches = false
    headers.forEach { (k, v) -> conn.setRequestProperty(k, v) }
    return conn
  }

  /** HTTP status of a GET; throws when the engine cannot be reached. */
  fun status(connectTimeoutMs: Int, readTimeoutMs: Int): Int {
    val conn = open(connectTimeoutMs, readTimeoutMs)
    return try {
      conn.responseCode
    } finally {
      conn.disconnect()
    }
  }
}
