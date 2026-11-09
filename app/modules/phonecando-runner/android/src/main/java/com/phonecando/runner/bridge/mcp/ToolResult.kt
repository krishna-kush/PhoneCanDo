package com.phonecando.runner.bridge.mcp

import com.phonecando.runner.bridge.Reply
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.ceil

// A route's reply as an MCP tool result: one text item, worded as the TS
// tools' client.ts words it, so a model reads the same over MCP as through
// the agent's own plugin. The data as JSON when the call worked; otherwise
// `error <code>: <message>` with isError, the bridge's refusals included
// (locked, busy, unavailable): they are the tool's outcome, which the model
// acts on, not a protocol failure. Keep the wording in step with client.ts.
// Pure.
object ToolResult {
  fun of(reply: Reply): JSONObject {
    val envelope = try {
      JSONObject(reply.body)
    } catch (_: Exception) {
      return result("bridge ${reply.status}: ${reply.body.take(300)}", isError = true)
    }
    if (envelope.opt("ok") == true) return result(JsonText.of(envelope.opt("data") ?: JSONObject()), isError = false)
    return result(errorText(envelope, reply.status), isError = true)
  }

  fun errorText(e: JSONObject, status: Int): String {
    val code = e.optString("code").ifEmpty { status.toString() }
    if (code == "control_busy") {
      val secs = maxOf(1, ceil(e.optLong("retryAfterMs", 30_000) / 1000.0).toInt())
      val holder = e.optString("holder").ifEmpty { "another agent" }
      return "error control_busy: the screen is in use by $holder; try again in about ${secs}s. " +
        "Wait, then call the tool again; do not loop quickly, and tell the user if it stays busy."
    }
    return "error $code: ${e.optString("message").ifEmpty { "unknown" }}"
  }

  private fun result(text: String, isError: Boolean): JSONObject = JSONObject()
    .put("content", JSONArray().put(JSONObject().put("type", "text").put("text", text)))
    .put("isError", isError)
}
