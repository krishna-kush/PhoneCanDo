package com.phonecando.runner

import android.util.Log
import java.net.HttpURLConnection
import java.net.URL

// Minimal SSE client: one daemon thread holding GET <eventsUrl>,
// assembling `data:` frames and dispatching parsed engine events. Reconnects
// with capped backoff; a 60s read timeout doubles as a dead-socket detector.
// Only android.util.Log is Android-specific. The service owns exactly one.
class SseClient(
  private val url: String,
  private val tag: String,
  private val onEvent: (EngineEvent.Parsed) -> Unit,
  private val password: String? = null,
) {
  @Volatile private var running = false
  private var thread: Thread? = null

  @Synchronized
  fun start() {
    if (running) return
    running = true
    thread = Thread({ loop() }, "phonecando-sse").also {
      it.isDaemon = true
      it.start()
    }
  }

  @Synchronized
  fun stop() {
    running = false
    thread?.interrupt()
    thread = null
  }

  fun isAlive(): Boolean = thread?.isAlive == true

  private fun loop() {
    var backoff = 1000L
    while (running) {
      var conn: HttpURLConnection? = null
      try {
        conn = URL(url).openConnection() as HttpURLConnection
        conn.setRequestProperty("Accept", "text/event-stream")
        if (!password.isNullOrEmpty()) {
          val cred = android.util.Base64.encodeToString(
            "opencode:$password".toByteArray(), android.util.Base64.NO_WRAP,
          )
          conn.setRequestProperty("Authorization", "Basic $cred")
        }
        conn.connectTimeout = 10000
        conn.readTimeout = 60000
        if (conn.responseCode != 200) throw Exception("sse http-${conn.responseCode}")
        backoff = 1000L
        readFrames(conn) { running }
      } catch (e: InterruptedException) {
        break
      } catch (e: Exception) {
        if (!running) break
        Log.w(tag, "sse dropped (${e.message}), retry in ${backoff}ms")
        try {
          Thread.sleep(backoff)
        } catch (_: InterruptedException) {
          break
        }
        backoff = minOf(backoff * 2, 30000L)
      } finally {
        try {
          conn?.disconnect()
        } catch (_: Exception) {
        }
      }
    }
  }

  // Blocks on the socket until `alive()` is false or the stream ends.
  // Extracted for clarity; the service never calls it directly.
  private fun readFrames(conn: HttpURLConnection, alive: () -> Boolean) {
    val reader = conn.inputStream.bufferedReader()
    val data = StringBuilder()
    while (alive()) {
      val line = try {
        reader.readLine() ?: break // clean EOF: reconnect
      } catch (_: InterruptedException) {
        break
      } catch (_: Exception) {
        break // socket timeout / reset: reconnect
      }
      if (line.startsWith("data:")) {
        data.append(line.removePrefix("data:").trim()).append('\n')
      } else if (line.isBlank() && data.isNotEmpty()) {
        val frame = data.toString().trim()
        data.clear()
        if (frame.isNotEmpty()) {
          try {
            EngineEvent.parse(frame)?.let(onEvent)
          } catch (_: Exception) {
            // one bad frame never kills the stream
          }
        }
      }
      // `event:` / `:comment` / retry lines are intentionally ignored:
      // the type always rides inside the JSON payload.
    }
  }
}
