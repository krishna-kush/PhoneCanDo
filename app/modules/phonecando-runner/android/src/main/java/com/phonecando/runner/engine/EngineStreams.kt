package com.phonecando.runner.engine

import com.phonecando.runner.TelemetryRecorder
import com.phonecando.runner.TelemetrySwitch
import com.phonecando.runner.agents.AgentKind
import com.phonecando.runner.agents.EngineEvent
import com.phonecando.runner.notify.AgentAlerts
import com.phonecando.runner.notify.ChatTracker

// Engine event streams: the supervisor opens one per ready engine, always.
// Activity (any event the kind maps to something other than OTHER, so not
// heartbeats or catalog updates) marks the agent used, which keeps a working
// engine from being stopped to make room for another, whether or not
// anyone is looking at it. Every event also goes to the agent's alerts
// (finished, failed, waiting for your answer while PhoneCanDo is not in
// front) and to the chats the service notification lists. Only while usage stats are on, a top-level session creation also
// counts once per agent and session id (a frame seen again after a
// reconnect does not count twice).
internal class EngineStreams(
  private val onActivity: (agentId: String) -> Unit,
  private val alerts: AgentAlerts,
  private val chats: ChatTracker,
) {
  // "<agentId> <sessionId>" already counted; bounded, oldest dropped first.
  private val createdSeen = object : LinkedHashMap<String, Boolean>() {
    override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Boolean>?): Boolean =
      size > CREATED_SEEN_MAX
  }

  /** A started stream, or null when the kind has none. */
  fun open(agentId: String, kind: AgentKind, port: Int, password: String): SseClient? {
    val stream = kind.eventStream(port.toString(), password) ?: return null
    alerts.reset(agentId)
    chats.attach(agentId, kind, port, password)
    return SseClient(stream, TAG, "phonecando-sse-$agentId", kind::parseEvent) { onEvent(agentId, it) }
      .also { it.start() }
  }

  private fun onEvent(agentId: String, event: EngineEvent) {
    if (event.sessionCreated && TelemetrySwitch.isEnabled()) countCreated(agentId, event.sessionId)
    if (event.kind != EngineEvent.Kind.OTHER || event.sessionCreated) onActivity(agentId)
    alerts.onEvent(agentId, event)
    chats.onEvent(agentId, event)
  }

  private fun countCreated(agentId: String, sessionId: String?) {
    if (sessionId != null) {
      synchronized(createdSeen) {
        if (createdSeen.put("$agentId $sessionId", true) != null) return
      }
    }
    TelemetryRecorder.sessionCreated()
  }

  private companion object {
    const val TAG = "PhoneCanDoEngineSse"
    const val CREATED_SEEN_MAX = 256
  }
}
