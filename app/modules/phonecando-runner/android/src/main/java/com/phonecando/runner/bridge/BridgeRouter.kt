package com.phonecando.runner.bridge

import com.phonecando.runner.AutomationHost
import com.phonecando.runner.AutomationUnavailableException
import com.phonecando.runner.agents.AgentRecord
import org.json.JSONObject

/** One authenticated call, as a route handler sees it. */
data class BridgeCall(val agent: AgentRecord, val route: Route, val body: JSONObject)

typealias RouteHandler = (BridgeCall) -> Reply

// Decides what an authenticated request gets, in this order: route lookup
// (404), flavor (lite/play have no full-only routes: 404), the phone-control
// switch (403), the accessibility service (503), the JSON body (400), the
// screen lease (409, full builds only), then the handler. A refused request
// never takes the lease. Pure: the automation host, the lease, the agent
// check and the handlers are injected.
class BridgeRouter(
  private val full: Boolean,
  private val automation: () -> AutomationHost?,
  private val lease: ScreenLease,
  private val alive: (agentId: String) -> Boolean,
  private val handlers: Map<Route, RouteHandler>,
  private val onError: (String, Throwable) -> Unit = { _, _ -> },
) {
  fun handle(agent: AgentRecord, method: String, path: String, body: String): Reply {
    val route = Route.find(method, path)
      ?: return if (!full && path.startsWith("/pce/")) Reply.notInBuild(path) else Reply.notFound(method, path)
    if (route.fullOnly && !full) return Reply.notInBuild(path)

    // The switch is in-memory in the app process (biometric-gated), so a
    // stale "on" cannot survive a restart. Lite/play have no driver and no
    // switch; their basic tools stay available.
    val host = automation()
    if (route.gated && full && host?.enabled != true) return Reply.automationOff()
    if (route.pce && host?.connected != true) return Reply.automationUnavailable()

    val json = if (route.method == "POST") {
      parse(body) ?: return Reply.badRequest("bad_json", "body must be a JSON object")
    } else {
      JSONObject()
    }

    // Lite/play have no driver whose flow another agent could break.
    val ticket = if (route.screen && full) {
      when (val claim = lease.claim(agent.id, agent.name, alive)) {
        is ScreenLease.Busy -> return Reply.busy(claim.holderName, claim.retryAfterMs)
        is ScreenLease.Granted -> claim.ticket
      }
    } else {
      null
    }
    var reply: Reply? = null
    try {
      val handler = handlers[route] ?: return Reply.notFound(method, path)
      reply = handler(BridgeCall(agent, route, json))
      return reply
    } catch (_: AutomationUnavailableException) {
      // The service disconnected between the connected check and the call:
      // the same 503 as a service that was never on, so the agent recovers
      // through mobile_open_accessibility instead of seeing a 500.
      return Reply.automationUnavailable()
    } catch (e: Exception) {
      onError("$method $path failed", e)
      return Reply.error(500, "internal", e.message ?: "bridge failure")
    } finally {
      // The holder's /app (mobile_return, "done with the phone") hands the
      // screen back at once instead of making the next agent wait it out.
      if (ticket != null) lease.done(ticket, release = route == Route.APP && reply?.status == 200)
    }
  }

  private fun parse(body: String): JSONObject? = try {
    JSONObject(body.ifBlank { "{}" })
  } catch (_: Exception) {
    null
  }
}
