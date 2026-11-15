package com.phonecando.runner.acp

import com.phonecando.runner.engine.acp.AcpItem
import com.phonecando.runner.engine.acp.AcpTurnEnd
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

// Tells the app what an agent's ACP turn shows while it runs (the
// phonecandoAcp event; the TS type is NativeAcpEvent; acpSnapshot gives
// the same item and question maps, AcpItem.toMap and AcpPermissionAsk.toMap):
//   {agentId, type:"item", item:{id, type:"text"|"thought"|"tool"|"plan", text?, title?, kind?, status?, entries?}}
//   {agentId, type:"busy", busy}
//   {agentId, type:"permission", permission:{requestId, title, toolKind, options:[{optionId, name, kind}]}}
//   {agentId, type:"permissionGone", requestId}
//   {agentId, type:"turnEnd", stopReason, error}
// An item comes as text streams in, so each item's updates within ITEM_MS
// go as one (its latest); every other event first sends the items that
// wait, so the app never hears a turn end before its last words. The
// native module sets [sink] when it is made (api/AcpFunctions); with none
// attached nothing is sent, and the app reads acpSnapshot when it comes
// back.
internal object AcpAppEvents {
  const val NAME = "phonecandoAcp"

  /** How long an item's updates are gathered before they go. */
  const val ITEM_MS = 150L

  @Volatile
  var sink: ((Map<String, Any?>) -> Unit)? = null

  // Per agent and item: the latest version not sent yet.
  private val waiting = ConcurrentHashMap<String, Pair<String, AcpItem>>()

  private val timer: ScheduledExecutorService by lazy {
    Executors.newSingleThreadScheduledExecutor { r -> Thread(r, "phonecando-acp-events").apply { isDaemon = true } }
  }

  fun item(agentId: String, item: AcpItem) {
    if (sink == null) return
    val key = agentId + "\u0000" + item.id
    if (waiting.put(key, agentId to item) == null) {
      timer.schedule(Runnable { sendItem(key) }, ITEM_MS, TimeUnit.MILLISECONDS)
    }
  }

  fun busy(agentId: String, busy: Boolean) = send(agentId, mapOf("type" to "busy", "busy" to busy))

  fun permission(agentId: String, permission: Map<String, Any?>) = send(agentId, mapOf("type" to "permission", "permission" to permission))

  fun permissionGone(agentId: String, requestId: String) = send(agentId, mapOf("type" to "permissionGone", "requestId" to requestId))

  fun turnEnd(agentId: String, end: AcpTurnEnd) =
    send(agentId, mapOf("type" to "turnEnd", "stopReason" to end.stopReason, "error" to end.error))

  private fun sendItem(key: String) {
    val (agentId, item) = waiting.remove(key) ?: return
    emit(mapOf("agentId" to agentId, "type" to "item", "item" to item.toMap()))
  }

  private fun send(agentId: String, event: Map<String, Any?>) {
    if (sink == null) return
    val prefix = agentId + "\u0000"
    waiting.keys.filter { it.startsWith(prefix) }.forEach(::sendItem)
    emit(mapOf<String, Any?>("agentId" to agentId) + event)
  }

  private fun emit(event: Map<String, Any?>) {
    val out = sink ?: return
    try {
      out(event)
    } catch (_: Exception) {
      // The module is gone; the next one reads acpSnapshot.
    }
  }
}
