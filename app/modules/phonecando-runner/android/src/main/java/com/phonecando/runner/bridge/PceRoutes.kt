package com.phonecando.runner.bridge

import com.phonecando.runner.AutomationHost
import com.phonecando.runner.AutomationUnavailableException
import org.json.JSONObject

// The automation routes (/pce/*, full builds only). The router has already
// checked the switch, the service and the screen lease. The PCE adapter
// answers {ok:true,...} / {ok:false,code,message}; we unwrap that into the
// bridge envelope (app-level failures stay 200 + ok:false). Pure.
class PceRoutes(private val automation: () -> AutomationHost?) {
  fun table(): Map<Route, RouteHandler> = mapOf(
    Route.PCE_DESCRIBE to { _ -> unwrap(host().describe()) },
    Route.PCE_OBSERVE to { call -> unwrap(host().observe(call.body)) },
    Route.PCE_ACT to { call -> unwrap(host().act(call.body)) },
    Route.PCE_PACK to { call -> unwrap(host().pack(call.body)) },
  )

  private fun host(): AutomationHost =
    automation() ?: throw AutomationUnavailableException("no automation host")

  companion object {
    fun unwrap(result: JSONObject): Reply {
      if (!result.optBoolean("ok", true)) {
        val error = Reply.errorBody(
          result.optString("code", "ui_error"),
          result.optString("message", result.optString("error", "ui action failed")),
        )
        result.optJSONObject("recover")?.let { error.put("recover", it) }
        result.optJSONArray("candidates")?.let { error.put("candidates", it) }
        return Reply(200, error.toString())
      }
      result.remove("ok")
      return Reply.ok(result)
    }
  }
}
