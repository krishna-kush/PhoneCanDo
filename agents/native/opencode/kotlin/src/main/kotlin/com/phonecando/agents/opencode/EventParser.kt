package com.phonecando.agents.opencode

import com.phonecando.agents.kit.EngineEvent
import com.phonecando.agents.kit.EngineEvent.Kind
import org.json.JSONObject

// opencode event frames → EngineEvent. Pure Kotlin, zero Android imports —
// feed it the exact frames captured on-device (see SseClient) and it extracts
// (type, session).
// v2 wire (device-captured): data: {"id":"evt_…","type":"session.text.delta",
// "data":{"sessionID":"ses_…",…}} — type at top level, session in data.
// v1 shapes (payload.*) are still accepted defensively.
// Mapping notes (all device-verified on v2): execution.started OR any
// step/reasoning/text/tool/inbox movement = WORKING; only
// session.execution.succeeded = FINISHED (step.ended is not the end of a
// run: in multi-step runs it comes between steps); execution.failed /
// session.error = FAILED; session.deleted = GONE. From the upstream schema
// and session runner (packages/schema, packages/core), not yet captured on
// device: a failed step is WORKING (it may be retried; a run's one verdict
// per busy period is execution.succeeded/failed/interrupted), and
// permission.asked and form.created are WAITING (the run is alive but
// blocked on the user; their replies and a cancelled form are WORKING).
// Deliberately OTHER: execution.interrupted (the user's own stop),
// catalog/agent/command/skill/websearch/reference/plugin/integration
// updates, usage, instructions, renamed, server.connected. The supervisor
// reads the stream for activity, telemetry and alerts (engine/EngineStreams):
// any kind but OTHER marks the engine used; notify/AlertRules alerts on
// FINISHED, FAILED and WAITING.
// session.created keeps kind OTHER: `sessionCreated` is true for a
// top-level session (no parentID; telemetry counts it), `childCreated` for
// a subagent's child session (its verdict raises no alert).
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
      // True end-of-run: only the execution verdict. step.ended is not
      // (device-verified: in multi-step runs it comes between steps, and
      // the last one precedes the final verdict by ms).
      "execution.succeeded" in type -> Kind.FINISHED
      "execution.failed" in type || type == "session.error" -> Kind.FAILED
      // The user's own stop: the run is over, with no verdict.
      "execution.interrupted" in type -> Kind.STOPPED
      // A pending form/permission: the run is alive but blocked on the user.
      type == "permission.asked" || type == "form.created" -> Kind.WAITING
      "execution.started" in type || "step.started" in type || "step.streamed" in type ||
        "step.failed" in type ||
        "reasoning." in type || "text." in type || "part." in type || "tool." in type ||
        "inbox." in type || "prompt." in type || "shell.started" in type ||
        "form." in type || "permission." in type -> Kind.WORKING
      "session.deleted" in type -> Kind.GONE
      // Deliberately OTHER: catalog/agent/command/skill/websearch/
      // reference/plugin/integration updates, usage, instructions, renamed,
      // server.connected, compaction.
      else -> Kind.OTHER
    }
    val created = type == "session.created"
    val child = created && hasParent(body)
    // session.renamed: {"sessionID":…,"title":…}; opencode names a chat
    // after its first message, often after that run has ended.
    val title = if (type == "session.renamed") body?.optString("title", "")?.trim()?.ifEmpty { null } else null
    return EngineEvent(
      kind,
      sid.ifEmpty { null },
      sessionCreated = created && !child,
      childCreated = child,
      title = title,
    )
  }

  private fun hasParent(body: JSONObject?): Boolean {
    if (body == null) return false
    val direct = body.opt("parentID")
    if (direct is String && direct.isNotEmpty()) return true
    val nested = body.optJSONObject("info")?.opt("parentID")
    return nested is String && nested.isNotEmpty()
  }
}
