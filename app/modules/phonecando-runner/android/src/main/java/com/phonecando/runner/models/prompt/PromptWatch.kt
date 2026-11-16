package com.phonecando.runner.models.prompt

import com.phonecando.runner.models.ModelServer
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

// Watches a model server read prompts. It asks the server's /slots
// (loopback, with the per-start key, a few hundred bytes; the pinned server
// answers it between decode steps, never behind a long prompt) every 2 s,
// and only while a server is busy for someone and someone could look: an
// agent bound to it has a run going (a working chat, ChatBoard) and the
// screen is on, or an ACP turn runs (its watch counts a model at work as
// a sign of life, engine/acp AcpTurnWatch, screen on or off). With several servers busy at once it watches the first
// (busy); the app shows one reading at a time. [onChange] hears each new reading (PromptReading), and null
// once nothing is read or nobody is busy. A failed ask keeps the last
// answer. Each answer also says whether the server is at work for its
// agents at all (working: reading or writing), for a short while. poke()
// whenever a run may have started (a chat moved); one thread
// at a time, which ends once nobody is busy. The key never leaves the
// request header.
internal class PromptWatch(
  private val target: () -> Target?,
  private val looking: () -> Boolean,
  private val onChange: (PromptReading?) -> Unit,
  private val fetch: (url: String, key: String) -> String? = ::getSlots,
  private val intervalMs: Long = INTERVAL_MS,
  private val clock: () -> Long = System::currentTimeMillis,
) {
  /** The server busy for [agentIds]: where to ask, with which key, and which model it is. */
  data class Target(
    val baseUrl: String,
    val key: String,
    val modelId: String,
    val modelName: String,
    val agentIds: List<String>,
  ) {
    override fun toString() = "Target(baseUrl=$baseUrl, key=<hidden>, modelId=$modelId, agentIds=$agentIds)"
  }

  private class Work(val agentIds: List<String>, val at: Long)

  private val lock = Any()
  private var running = false
  @Volatile private var current: PromptReading? = null
  @Volatile private var work: Work? = null

  /** The last reading told; null when none. */
  fun current(): PromptReading? = current

  /** The server was at work for [agentId] (reading its prompt or writing) at a look under WORK_FRESH_MS ago. */
  fun working(agentId: String): Boolean {
    val w = work ?: return false
    return agentId in w.agentIds && clock() - w.at < WORK_FRESH_MS
  }

  /** Starts watching when the server is busy for someone and no watch runs. */
  fun poke() {
    synchronized(lock) {
      if (running || target() == null) return
      running = true
    }
    thread(name = "phonecando-prompt-watch", isDaemon = true) { loop() }
  }

  private fun loop() {
    try {
      while (tick()) Thread.sleep(intervalMs)
    } catch (_: InterruptedException) {
      // Daemon thread: ends with the process.
    } finally {
      synchronized(lock) { running = false }
      publish(null)
      // A poke while this one ended found it running: look once more.
      if (target() != null) poke()
    }
  }

  /** One look; false once nobody is busy, which ends the watch. */
  fun tick(): Boolean {
    val busy = target() ?: return false
    if (!looking()) return true
    val body = fetch("${busy.baseUrl}/slots", busy.key) ?: return true
    work = if (PromptReading.processing(body)) Work(busy.agentIds, clock()) else null
    val slot = PromptReading.readingSlot(body)
    publish(slot?.let { PromptReading(busy.modelId, busy.modelName, busy.agentIds, it.read, it.cached, it.total) })
    return true
  }

  private fun publish(next: PromptReading?) {
    synchronized(lock) {
      if (next == current) return
      current = next
    }
    onChange(next)
  }

  companion object {
    const val INTERVAL_MS = 2_000L

    /** How long a look's "at work" holds: a few looks, so one failed ask does not end it. */
    const val WORK_FRESH_MS = 3 * INTERVAL_MS
    private const val CONNECT_MS = 1_000
    private const val READ_MS = 5_000

    /** The first server busy for agents holding it with a run going ([working]); null when none is. */
    fun busy(serving: List<ModelServer.Serving>, working: Set<String>): Target? {
      for (server in serving) {
        val agents = server.holders.filter(working::contains).sorted()
        if (agents.isEmpty()) continue
        return Target(server.endpoint.baseUrl, server.endpoint.key, server.model.id, server.model.name, agents)
      }
      return null
    }

    // GET /slots with the server's key; null on any failure.
    private fun getSlots(url: String, key: String): String? {
      val conn = try {
        URL(url).openConnection() as HttpURLConnection
      } catch (_: IOException) {
        return null
      }
      return try {
        conn.connectTimeout = CONNECT_MS
        conn.readTimeout = READ_MS
        conn.setRequestProperty("Authorization", "Bearer $key")
        if (conn.responseCode != 200) null else conn.inputStream.bufferedReader().use { it.readText() }
      } catch (_: IOException) {
        null
      } finally {
        conn.disconnect()
      }
    }
  }
}
