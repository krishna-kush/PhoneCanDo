package com.phonecando.runner.bridge

import com.phonecando.runner.appaccess.AppAccess
import com.phonecando.runner.appaccess.AppAccessRules
import org.json.JSONObject

// /app-access (full builds only, gated; phone_ask_app): an agent a screen
// call turned away with app_not_allowed asks the user about that app and
// blocks until the answer, so it carries on in the same turn (PromptFlows
// has the wait, BridgePrompts.resolveApp the answer). An app already
// allowed or blocked answers at once, with no question.
class AppAccessRoutes(private val flows: PromptFlows, private val access: () -> AppAccess) {
  fun table(): Map<Route, RouteHandler> = mapOf(Route.APP_ACCESS to { call -> ask(call) })

  // The wait stays under five minutes, where common HTTP clients give up
  // on a response. `blocked`: the app ended up on the No list, by this
  // answer or another.
  private fun ask(call: BridgeCall): Reply {
    val pkg = call.body.optString("package").trim()
    if (!AppAccessRules.isPackageName(pkg)) {
      return Reply.badRequest("bad_request", "package must be an Android package name, as the refusal gave it")
    }
    val waitMs = call.body.optLong("waitMs", 120_000).coerceIn(30_000, 240_000)
    val gate = access()
    val agentId = call.agent.id
    val out = flows.app(call.agent, pkg, gate.label(pkg), waitMs) { gate.verdict(pkg, agentId) }
    val data = JSONObject().put("asked", out.asked).put("allowed", out.allowed)
    if (out.asked) data.put("answer", out.answer ?: JSONObject.NULL).put("notified", out.notified)
    if (out.blocked) data.put("blocked", true)
    return Reply.ok(data)
  }
}
