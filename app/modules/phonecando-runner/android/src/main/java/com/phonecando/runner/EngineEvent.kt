package com.phonecando.runner

import org.json.JSONObject

// Parsed engine event. Pure Kotlin, zero Android imports — feed it the exact
// frames captured on-device (see SseClient) and it extracts (type, session).
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
object EngineEvent {
  data class Parsed(val kind: Kind, val sessionId: String?)

  enum class Kind {
    /** Generation activity: step/text/part/message movement. */
    WORKING,
    /** A step ended cleanly. */
    FINISHED,
    /** A step failed. */
    FAILED,
    /** Session deleted elsewhere. */
    GONE,
    /** Anything else (server.connected, catalog, TUI toasts…). */
    OTHER,
  }

  fun parse(data: String): Parsed? {
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
      sid = payload.optJSONObject("properties")?.let {
        it.optString("sessionID", "").ifEmpty { it.optString("sessionId", "") }
      }.orEmpty()
      if (type == "sync") {
        val se = payload.optJSONObject("syncEvent") ?: return null
        type = se.optString("type", "")
        sid = se.optString("aggregateID", "").ifEmpty {
          se.optJSONObject("data")?.optString("sessionID", "").orEmpty()
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
    return Parsed(kind, sid.ifEmpty { null })
  }
}
