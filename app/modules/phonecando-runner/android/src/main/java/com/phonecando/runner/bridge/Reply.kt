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
            "call phone_open_accessibility to ask the user to turn it back on",
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

    // The app in front is one the user has not let agents use yet
    // (appaccess/): the agent asks through phone_ask_app, with the package
    // named in the message, as the tools show the model only code and message.
    fun appNotAllowed(pkg: String, label: String) = appRefusal(
      "app_not_allowed",
      "PhoneCanDo asks the user before agents use $label. Call phone_ask_app with package \"$pkg\" and wait for " +
        "the answer. Never work around it.",
      pkg,
      label,
    )

    /** The user said No to agents in this app; Allow all does not lift it. */
    fun appBlocked(pkg: String, label: String) = appRefusal(
      "app_blocked",
      "The user blocked agents from $label. Don't use it; if you need it, call phone_hand_over and ask the user.",
      pkg,
      label,
    )

    // A tap on a notification whose app no installed app's name matches
    // (appaccess/ForeignParts), so nobody can be asked about it. The name is
    // screen text: one line, cut short, in quotes.
    fun notificationHidden(label: String): Reply {
      val name = label.lines().first().take(40)
      return Reply(
        403,
        errorBody(
          "notification_hidden",
          "That notification is from \"$name\", an app PhoneCanDo can't name, so agents can't use it. " +
            "If you need it, call phone_hand_over and ask the user.",
        ).put("label", name).toString(),
      )
    }

    /** A question waits in PhoneCanDo and it is in front (appaccess/OwnQuestions): only the user answers it. */
    fun userDeciding() = error(
      409,
      "user_deciding",
      "The user is answering a question in PhoneCanDo. Wait for it; never tap PhoneCanDo's own questions.",
    )

    private fun appRefusal(code: String, message: String, pkg: String, label: String) = Reply(
      403,
      errorBody(code, message).put("package", pkg).put("label", label).toString(),
    )

    /** Over phone_notify's limits (presence/NotifyRules): it may post again in `retryAfterMs`. */
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
