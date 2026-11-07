package com.phonecando.runner.engine

import android.util.Log
import com.phonecando.runner.agents.EngineEvent
import com.phonecando.runner.agents.HttpProbe
import java.net.HttpURLConnection

// Minimal SSE client: one daemon thread holding the engine's event stream
// (AgentKind.eventStream), assembling `data:` frames and dispatching them as
// engine events through the kind's parser. Reconnects with capped backoff; a
// 60s read timeout doubles as a dead-socket detector. Only android.util.Log
// is Android-specific. The supervisor holds one per ready engine
// (EngineStreams).
internal class SseClient(
  private val stream: HttpProbe,
  private val tag: String,
  private val threadName: String,
  private val parse: (String) -> EngineEvent?,
  private val onEvent: (EngineEvent) -> Unit,
) {
  @Volatile private var running = false
  private var thread: Thread? = null

  @Synchronized
  fun start() {
    if (running) return
    running = true
    thread = Thread({ loop() }, threadName).also {
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
        conn = stream.open(connectTimeoutMs = 10000, readTimeoutMs = 60000)
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
            parse(frame)?.let(onEvent)
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
