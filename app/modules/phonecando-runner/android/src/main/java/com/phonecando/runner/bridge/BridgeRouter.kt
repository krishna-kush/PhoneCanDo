package com.phonecando.runner.bridge

import com.phonecando.runner.AutomationHost
import com.phonecando.runner.AutomationUnavailableException
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.controllock.ControlLock
import org.json.JSONObject

/** One authenticated call, as a route handler sees it. */
data class BridgeCall(val agent: AgentRecord, val route: Route, val body: JSONObject)

typealias RouteHandler = (BridgeCall) -> Reply

// Decides what an authenticated request gets, in this order: route lookup
// (404), flavor (lite/play have no full-only routes: 404), the phone-control
// lock for this agent (403), the accessibility service (503), the JSON body
// (400), the screen lease (409, full builds only), then the handler. A
// refused request never takes the lease, though it may wait in line: a
// locked agent's screen request, or its /unlock, while another agent has
// the screen gets the 409 with its place (ScreenLease) instead of a 403 or
// a dialog over that agent's app. A turn another agent's message started
// (`startedByAgent`) gets 409 screen_refused unless the line handed it the
// screen. Pure: the automation host, the lock, the lease, the agent checks
// and the handlers are injected.
class BridgeRouter(
  private val full: Boolean,
  private val automation: () -> AutomationHost?,
  private val lock: ControlLock,
  private val lease: ScreenLease,
  private val alive: (agentId: String) -> Boolean,
  private val handlers: Map<Route, RouteHandler>,
  private val onError: (String, Throwable) -> Unit = { _, _ -> },
  private val startedByAgent: (agentId: String) -> Boolean = { false },
) {
  fun handle(agent: AgentRecord, method: String, path: String, body: String): Reply {
    val route = Route.find(method, path)
      ?: return if (!full && path.startsWith("/pce/")) Reply.notInBuild(path) else Reply.notFound(method, path)
    if (route.fullOnly && !full) return Reply.notInBuild(path)

    // Only the app's UI unlocks, after the user's biometric (ControlLock).
    // Lite/play have no driver and no lock; their basic tools stay available.
    val host = automation()
    if (route.gated && full && !lock.unlockedFor(agent.id, use = true)) {
      // A place in line is never the screen: only an unlocked agent ever
      // gets a ticket, and the first in line still needs its unlock.
      if (route.screen) lease.waitInLine(agent.id, agent.name, alive, startedByAgent(agent.id))?.let { return refusal(it) }
      return Reply.automationOff()
    }
    if (route.pce && host?.connected != true) return Reply.automationUnavailable()

    val json = if (route.method == "POST") {
      parse(body) ?: return Reply.badRequest("bad_json", "body must be a JSON object")
    } else {
      JSONObject()
    }

    // Lite/play have no driver whose flow another agent could break.
    val ticket = if (route.screen && full) {
      when (val claim = lease.claim(agent.id, agent.name, alive, startedByAgent(agent.id))) {
        is ScreenLease.Granted -> claim.ticket
        else -> return refusal(claim)
      }
    } else {
      null
    }
    // The unlock dialog waits its turn too, so it never opens over another
    // agent's app; while it is open the agent's time on the screen stands
    // still (a fingerprint or PIN can take longer than the lease).
    val prompting = route == Route.UNLOCK && full && !lock.unlockedFor(agent.id)
    if (prompting) lease.promptOpened(agent.id, agent.name, alive, startedByAgent(agent.id))?.let { return refusal(it) }
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
      // /app (mobile_return) is the agent saying it is done with the phone:
      // the holder hands the screen back at once instead of making the next
      // agent wait it out, and an ask-mode unlock ends with the task.
      val handedBack = route == Route.APP && reply?.status == 200
      if (ticket != null) lease.done(ticket, release = handedBack)
      if (handedBack && full) lock.endAsk(agent.id)
      // A yes starts its time over; a no, or no answer, passes the screen on.
      if (prompting) lease.promptClosed(agent.id, keep = lock.unlockedFor(agent.id))
    }
  }

  private fun refusal(claim: ScreenLease.Claim): Reply = when (claim) {
    is ScreenLease.Busy -> Reply.busy(claim.holderName, claim.retryAfterMs, claim.place)
    else -> Reply.screenRefused()
  }

  private fun parse(body: String): JSONObject? = try {
    JSONObject(body.ifBlank { "{}" })
  } catch (_: Exception) {
    null
  }
}
