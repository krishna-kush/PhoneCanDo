package com.phonecando.runner.engine.stop

import android.content.Context
import android.util.Log
import com.phonecando.agents.kit.AgentKind
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.engine.acp.AcpEngines

// Stops an agent's turn where its kind can, for Stop on the phone's
// controls (presence/): in ACP mode its busy turn is cancelled; a server
// engine whose kind has `chats.interrupt` has every chat its server runs
// now (`chats.active`) stopped, on loopback with the agent's password and
// its engine's port. Any other agent is only told, at its next screen
// call (HandsGate). Blocks on those calls: never on the main thread.
internal class TurnStop(context: Context) {
  private val app = context.applicationContext ?: context

  fun stop(agentId: String) {
    val acp = AcpEngines.of(agentId)
    if (acp != null) {
      if (acp.busy) acp.cancel()
      return
    }
    val port = Engines.peek()?.livePort(agentId)?.toString() ?: return
    val agent = AgentStores.get(app).get(agentId) ?: return
    val kind = KindCatalogs.get(app).get(agent.kind) ?: return
    for (sessionId in running(kind, port, agent.password).orEmpty()) {
      val probe = kind.interruptChat(port, agent.password, sessionId) ?: continue
      val status = runCatching { probe.status(CONNECT_MS, READ_MS) }.getOrElse { -1 }
      if (status !in 200..299) Log.w(TAG, "chat of $agentId not stopped: $status")
    }
  }

  // The chats its server runs now; null when it did not answer.
  private fun running(kind: AgentKind, port: String, password: String): Set<String>? = try {
    val conn = kind.activeChats(port, password)?.open(CONNECT_MS, READ_MS)
    try {
      if (conn == null || conn.responseCode != 200) null else kind.parseActiveChats(conn.inputStream.bufferedReader().use { it.readText() })
    } finally {
      conn?.disconnect()
    }
  } catch (e: Exception) {
    Log.w(TAG, "running chats of an agent not read: ${e.javaClass.simpleName}")
    null
  }

  private companion object {
    const val TAG = "PhoneCanDoTurnStop"
    const val CONNECT_MS = 1_000
    const val READ_MS = 5_000
  }
}
