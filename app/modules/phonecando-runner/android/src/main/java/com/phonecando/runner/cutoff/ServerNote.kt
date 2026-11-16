package com.phonecando.runner.cutoff

import android.content.Context
import android.util.Log
import com.phonecando.agents.kit.InboxCall
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.messages.delivery.KindInbox

// The note to go on for a server kind brought back (opencode): posted into
// each chat it was cut off in, by name (the board knows no chat yet in a
// new process), through its kind's wake call (`inbox.server.wake`, which
// starts a run), on loopback with its password, once its engine is ready.
internal object ServerNote {
  private const val TAG = "PhoneCanDoCutOff"
  private const val CONNECT_MS = 5_000
  private const val READ_MS = 15_000

  /** True when at least one of [chats] took [text]. */
  fun post(context: Context, agentId: String, chats: List<String>, text: String): Boolean {
    val port = Engines.peek()?.livePort(agentId) ?: return false
    val agent = AgentStores.get(context).get(agentId) ?: return false
    val inbox = KindCatalogs.get(context).get(agent.kind)?.let(KindInbox::of) ?: return false
    var took = false
    for (chat in chats.distinct()) {
      val request = inbox.request(InboxCall.WAKE, port.toString(), agent.password, chat, text) ?: continue
      val status = try {
        request.send(CONNECT_MS, READ_MS)
      } catch (e: Exception) {
        Log.w(TAG, "note to go on not posted to $agentId", e)
        -1
      }
      if (status in 200..299) took = true else Log.w(TAG, "note to go on for $agentId answered $status")
    }
    return took
  }
}
