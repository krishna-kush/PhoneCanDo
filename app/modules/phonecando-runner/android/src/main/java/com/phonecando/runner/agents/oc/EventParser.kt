package com.phonecando.runner.agents.oc

import com.phonecando.runner.agents.EngineEvent
import com.phonecando.runner.agents.EngineEvent.Kind
import org.json.JSONObject

// opencode event frames → EngineEvent. Pure Kotlin, zero Android imports —
// feed it the exact frames captured on-device (see SseClient) and it extracts
// (type, session).
// v2 wire (device-captured): data: {"id":"evt_…","type":"session.text.delta",
// "data":{"sessionID":"ses_…",…}} — type at top level, session in data.
// v1 shapes (payload.*) are still accepted defensively.
// Mapping notes (all device-verified on v2): execution.started OR any
// step/reasoning/text/tool/inbox movement = WORKING; only
// session.execution.succeeded clears (step.ended does NOT — multi-step runs
// would flicker Idle between steps); execution.failed / session.error =
// FAILED; session.deleted = GONE. Deliberately ignored: catalog/agent/
// command/skill/websearch/reference/plugin/integration updates, usage,
// instructions, renamed (title poll covers it), server.connected.
// Telemetry: `sessionCreated` is true for session.created of a top-level
// session (no parentID: subagent child sessions are not counted); its kind
// stays OTHER, so the watch logic is unchanged.
internal object EventParser {
  fun parse(data: String): EngineEvent? {
    val root = try {
      JSONObject(data)
    } catch (_: Exception) {
      return null
    }
    // v2 envelope first: {"type":"session.text.delta","data":{"sessionID":…}}.
    // Forms nest it one deeper: {"type":"form.created","data":{"form":{
    // "sessionID":…}}} — same for permission requests.
    var type = root.optString("type", "")
    val data = root.optJSONObject("data")
    var sid = data?.let {
      it.optString("sessionID", "").ifEmpty { it.optString("sessionId", "") }
    }.orEmpty()
    // The object carrying the session fields (parentID or info.parentID).
    var body: JSONObject? = data
    if (sid.isEmpty()) {
      sid = data?.optJSONObject("form")?.optString("sessionID", "").orEmpty()
    }
    if (sid.isEmpty()) {
      sid = data?.optJSONObject("request")?.optString("sessionID", "").orEmpty()
    }
    if (sid.isEmpty()) {
      sid = root.optJSONObject("durable")?.optString("aggregateID", "").orEmpty()
    }
    if (type.isEmpty()) {
      // v1 envelope: {"payload":{"type":…,"properties":{"sessionID":…}}}.
      val payload = root.optJSONObject("payload") ?: return null
      type = payload.optString("type", "")
      body = payload.optJSONObject("properties")
      sid = body?.let {
        it.optString("sessionID", "").ifEmpty { it.optString("sessionId", "") }
      }.orEmpty()
      if (type == "sync") {
        val se = payload.optJSONObject("syncEvent") ?: return null
        type = se.optString("type", "")
        body = se.optJSONObject("data")
        sid = se.optString("aggregateID", "").ifEmpty {
          body?.optString("sessionID", "").orEmpty()
        }
      }
    }
    val kind = when {
      // True end-of-run: only the execution verdict clears Working.
      // step.ended deliberately does NOT — multi-step runs would flicker
      // Idle between steps (device-verified: step.ended precedes the final
      // verdict by ms).
      "execution.succeeded" in type -> Kind.FINISHED
      "execution.failed" in type || "step.failed" in type || type == "session.error" -> Kind.FAILED
      "execution.started" in type || "step.started" in type || "step.streamed" in type ||
        "reasoning." in type || "text." in type || "part." in type || "tool." in type ||
        "inbox." in type || "prompt." in type || "shell.started" in type ||
        // A pending form/permission means the run is alive but blocked on the
        // user — latch Working until the execution verdict clears it.
        "form." in type || "permission." in type -> Kind.WORKING
      "session.deleted" in type -> Kind.GONE
      // Deliberately ignored: catalog/agent/command/skill/websearch/
      // reference/plugin/integration updates, usage, instructions, renamed
      // (title poll covers it), server.connected, compaction.
      else -> Kind.OTHER
    }
    val created = type == "session.created" && !hasParent(body)
    return EngineEvent(kind, sid.ifEmpty { null }, created)
  }

  private fun hasParent(body: JSONObject?): Boolean {
    if (body == null) return false
    val direct = body.opt("parentID")
    if (direct is String && direct.isNotEmpty()) return true
    val nested = body.optJSONObject("info")?.opt("parentID")
    return nested is String && nested.isNotEmpty()
  }
}
