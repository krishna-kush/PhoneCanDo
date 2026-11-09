package com.phonecando.runner.bridge

import org.json.JSONObject

// One bridge response: an HTTP status and the envelope
// {"ok":true,"data":...} / {"ok":false,"code":...,"message":...}. App-level
// failures (no app to share to, a PCE error) are 200 + ok:false; the status
// is for the bridge's own refusals. /mcp answers JSON-RPC instead (an empty
// body for 202, `Allow` on 405). Pure.
data class Reply(val status: Int, val body: String, val headers: Map<String, String> = emptyMap()) {
  companion object {
    fun ok(data: JSONObject) = Reply(200, JSONObject().put("ok", true).put("data", data).toString())

    fun error(status: Int, code: String, message: String) = Reply(status, errorBody(code, message).toString())

    /** An app-level failure: the call ran and did not work. */
    fun fail(code: String, message: String) = error(200, code, message)

    fun badRequest(code: String, message: String) = error(400, code, message)

    fun notFound(method: String, path: String) = error(404, "not_found", "no route $method $path")

    /** A full-only route on lite/play. */
    fun notInBuild(path: String) = error(404, "not_found", "no route for $path in this build")

    fun automationOff() = error(403, "automation_off", "phone control is locked; unlock it in PhoneCanDo settings")

    fun automationUnavailable() =
      error(503, "automation_unavailable", "enable PhoneCanDo in Android accessibility settings")

    /** Another agent holds the screen (ScreenLease). */
    fun busy(holder: String, retryAfterMs: Long) = Reply(
      409,
      errorBody("control_busy", "the screen is in use by $holder; try again in a moment")
        .put("holder", holder)
        .put("retryAfterMs", retryAfterMs)
        .toString(),
    )

    fun errorBody(code: String, message: String): JSONObject =
      JSONObject().put("ok", false).put("code", code).put("message", message)
  }
}
