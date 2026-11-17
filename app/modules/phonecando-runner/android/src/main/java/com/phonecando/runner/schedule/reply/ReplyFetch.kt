package com.phonecando.runner.schedule.reply

import android.content.Context
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.engine.Engines

// Reads a server chat's last reply through its kind's `chats.reply` (its
// parser hook), on loopback with the agent's password and its engine's
// port, as chat titles are read (notify/ChatTracker). Null when the kind
// reads none, the engine is down or it answers anything but 200; throws
// when the engine cannot be reached.
internal class ReplyFetch(context: Context) {
  private val app = context.applicationContext ?: context

  fun read(agentId: String, sessionId: String): String? {
    val port = Engines.peek()?.livePort(agentId) ?: return null
    val agent = AgentStores.get(app).get(agentId) ?: return null
    val kind = KindCatalogs.get(app).get(agent.kind) ?: return null
    val probe = kind.chatReply(port.toString(), agent.password, sessionId) ?: return null
    val conn = probe.open(CONNECT_MS, READ_MS)
    return try {
      if (conn.responseCode != 200) return null
      kind.parseChatReply(conn.inputStream.bufferedReader().use { it.readText() })
    } finally {
      conn.disconnect()
    }
  }

  private companion object {
    const val CONNECT_MS = 1_000
    const val READ_MS = 5_000
  }
}
