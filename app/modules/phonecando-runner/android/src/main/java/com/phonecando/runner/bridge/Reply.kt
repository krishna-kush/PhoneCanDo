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

    /** `autoOff`: Auto off turned the service off (autooff/), which the agent hears so it can tell the user. */
    fun automationUnavailable(autoOff: Boolean = false) =
      if (autoOff) {
        error(
          503,
          "automation_unavailable",
          "Auto off turned PhoneCanDo's accessibility service off while no agent used the screen, so payment apps open; " +
            "call mobile_open_accessibility to ask the user to turn it back on",
        )
      } else {
        error(503, "automation_unavailable", "enable PhoneCanDo in Android accessibility settings")
      }

    /** Another agent has the screen (ScreenLease): the caller waits in line at `place`. */
    fun busy(holder: String, retryAfterMs: Long, place: Int) = Reply(
      409,
      errorBody("control_busy", "$holder holds the screen; you are #$place in line; we'll message you when it is yours")
        .put("holder", holder)
        .put("retryAfterMs", retryAfterMs)
        .put("place", place)
        .toString(),
    )

    /** A turn another agent's message started asked for the screen (ScreenLease). */
    fun screenRefused() = error(
      409,
      "screen_refused",
      "a turn another agent's message started can't take the screen; the user or your own earlier request in the queue can",
    )

    /** You have the phone's controls (presence/HandsGate): [message] says what the caller can do meanwhile. */
    fun userHasControls(message: String) = error(409, "user_has_controls", message)

    /** You stopped the caller to use the phone (presence/HandsGate): it ends its turn. */
    fun pausedByUser(message: String) = error(409, "paused_by_user", message)

    /** Over mobile_notify's limits (presence/NotifyRules): it may post again in `retryAfterMs`. */
    fun notifyTooOften(retryAfterMs: Long) = Reply(
      429,
      errorBody("notify_too_often", "you notified the user too often; at most one a minute and five an hour")
        .put("retryAfterMs", retryAfterMs)
        .toString(),
    )

    fun errorBody(code: String, message: String): JSONObject =
      JSONObject().put("ok", false).put("code", code).put("message", message)
  }
}
