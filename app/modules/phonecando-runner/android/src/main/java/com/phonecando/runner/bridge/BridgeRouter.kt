package com.phonecando.runner.bridge

import com.phonecando.runner.AutomationHost
import com.phonecando.runner.AutomationUnavailableException
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.appaccess.AppAccess
import com.phonecando.runner.appaccess.AppAccessRules
import com.phonecando.runner.appaccess.AppTargets
import com.phonecando.runner.appaccess.AppVerdict
import com.phonecando.runner.appaccess.OwnQuestions
import com.phonecando.runner.controllock.ControlLock
import com.phonecando.runner.presence.HandOver
import com.phonecando.runner.presence.HandsGate
import com.phonecando.runner.presence.HandsText
import org.json.JSONObject

/** One authenticated call, as a route handler sees it. */
data class BridgeCall(val agent: AgentRecord, val route: Route, val body: JSONObject)

typealias RouteHandler = (BridgeCall) -> Reply

// Decides what an authenticated request gets, in this order: route lookup
// (404), flavor (lite/play have no full-only routes: 404), the phone-control
// lock for this agent (403), the accessibility service (503), the hands
// (409 while you have the phone's controls, full builds only: HandsGate),
// the JSON body (400), the app in front for the PCE's screen routes, or
// the app a launch opens, or the app /open hands its link to (403
// app_not_allowed or app_blocked, full builds only: appaccess/; and 409
// user_deciding for a tap or pack run on PhoneCanDo's own screen while the
// user has a question to answer there: OwnQuestions), the screen lease
// (409, full builds only), then the handler; an observe or pack result
// that names an app agents may not use is dropped for that 403. A
// refused request never takes the lease, though it may wait in line: a
// locked agent's screen request, or its /unlock or /app-access question,
// while another agent has the screen gets the 409 with its place
// (ScreenLease) instead of a 403 or a dialog over that agent's app. A turn another agent's message started
// (`startedByAgent`) gets 409 screen_refused unless the line handed it the
// screen. While you have the controls, the agent you took them from may
// only observe (WATCH; it needs no lease, its time standing still) or
// nothing at all (PAUSED: paused_by_user, told to end its turn; a repeat
// call stops its turn, `onPaused`); every other agent gets
// user_has_controls. An agent you left stopped gets paused_by_user too
// until the run it was stopped in ends (`leftStopped`). Pure: the
// automation host, the lock, the lease, the hand-over, the app list, the
// agent checks and the handlers are injected.
class BridgeRouter(
  private val full: Boolean,
  private val automation: () -> AutomationHost?,
  private val lock: ControlLock,
  private val lease: ScreenLease,
  private val alive: (agentId: String) -> Boolean,
  private val handlers: Map<Route, RouteHandler>,
  private val onError: (String, Throwable) -> Unit = { _, _ -> },
  private val startedByAgent: (agentId: String) -> Boolean = { false },
  // A screen request was granted: the overlay shows its driver at once.
  private val onDrive: () -> Unit = {},
  // The hand-over to you now (presence/), null when none.
  private val handOver: () -> HandOver? = { null },
  // A screen request of an agent you stopped was refused.
  private val onPaused: (agentId: String) -> Unit = {},
  // You left the agent stopped and the run it was stopped in goes on.
  private val leftStopped: (agentId: String) -> Boolean = { false },
  // Auto off turned the accessibility service off (autooff/): the 503 says so.
  private val autoOff: () -> Boolean = { false },
  // Which apps agents may reach (appaccess/); null: no app checks.
  private val appAccess: AppAccess? = null,
  // PhoneCanDo's own package, and whether the user has a question to answer in it.
  private val ownPackage: String? = null,
  private val questionWaiting: () -> Boolean = { false },
  // The app Android would hand a /open link to (appaccess/PhoneApps); null: unknown.
  private val linkHandler: (url: String) -> String? = { null },
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
    if (route.pce && host?.connected != true) return Reply.automationUnavailable(autoOff())

    // Only full builds have a driver to hand the controls over from.
    val hands = if (full && route.screen) handOver() else null
    val left = full && route.screen && leftStopped(agent.id)
    when (HandsGate.check(agent.id, route, hands, left)) {
      HandsGate.Refusal.PAUSED_BY_USER -> {
        onPaused(agent.id)
        return Reply.pausedByUser(HandsText.PAUSED)
      }
      HandsGate.Refusal.USER_HAS_CONTROLS ->
        return Reply.userHasControls(if (hands?.agentId == agent.id) HandsText.USER_HAS_CONTROLS else HandsText.SOMEONE_ELSE)
      null -> {}
    }

    val json = if (route.method == "POST") {
      parse(body) ?: return Reply.badRequest("bad_json", "body must be a JSON object")
    } else {
      JSONObject()
    }

    // Before the lease, so a refusal never takes the screen.
    // A launch is judged by the app it opens, a link by the app Android
    // hands it to, everything else by the app in front.
    val pceScreen = full && route.pce && route.screen
    val apps = if (pceScreen) appAccess else null
    if (pceScreen) {
      val front = host?.frontPackage()
      val launched = if (route == Route.PCE_ACT) AppTargets.launched(json) else null
      if (apps != null) appRefusal(apps, launched ?: front, agent.id)?.let { return it }
      if (route != Route.PCE_OBSERVE && OwnQuestions.refuse(front, ownPackage, questionWaiting)) return Reply.userDeciding()
    }
    if (route == Route.OPEN && full && appAccess != null) {
      appRefusal(appAccess, linkHandler(json.optString("url")), agent.id)?.let { return it }
    }

    // Lite/play have no driver whose flow another agent could break. The
    // agent watching you drive observes on time that stands still.
    val ticket = if (route.screen && full && hands == null) {
      when (val claim = lease.claim(agent.id, agent.name, alive, startedByAgent(agent.id))) {
        is ScreenLease.Granted -> claim.ticket.also { onDrive() }
        else -> return refusal(claim)
      }
    } else {
      null
    }
    // The unlock dialog and the app question wait their turn too, so neither
    // opens over another agent's app; while one is open the agent's time on
    // the screen stands still (a fingerprint or PIN, or a decision, can take
    // longer than the lease).
    val askedApp = if (route == Route.APP_ACCESS && full) json.optString("package").trim() else ""
    val asking = appAccess != null && AppAccessRules.isPackageName(askedApp) &&
      appAccess.verdict(askedApp, agent.id) == AppVerdict.ASK
    val prompting = (route == Route.UNLOCK && full && !lock.unlockedFor(agent.id)) || asking
    if (prompting) lease.promptOpened(agent.id, agent.name, alive, startedByAgent(agent.id))?.let { return refusal(it) }
    var reply: Reply? = null
    try {
      val handler = handlers[route] ?: return Reply.notFound(method, path)
      reply = handler(BridgeCall(agent, route, json))
      if (apps != null && (route == Route.PCE_OBSERVE || route == Route.PCE_PACK)) reply = shownApp(apps, reply, agent.id)
      return reply
    } catch (_: AutomationUnavailableException) {
      // The service disconnected between the connected check and the call:
      // the same 503 as a service that was never on, so the agent recovers
      // through phone_open_accessibility instead of seeing a 500.
      return Reply.automationUnavailable(autoOff())
    } catch (e: Exception) {
      onError("$method $path failed", e)
      return Reply.error(500, "internal", e.message ?: "bridge failure")
    } finally {
      // /app (phone_return) is the agent saying it is done with the phone:
      // the holder hands the screen back at once instead of making the next
      // agent wait it out, and an ask-mode unlock ends with the task, its
      // "Just now" apps too.
      val handedBack = route == Route.APP && reply?.status == 200
      if (ticket != null) lease.done(ticket, release = handedBack)
      if (handedBack && full) {
        lock.endAsk(agent.id)
        appAccess?.endJustNow(agent.id)
      }
      // A yes starts its time over; a no, or no answer, passes the screen on.
      if (prompting) {
        val yes = if (asking) appAccess?.verdict(askedApp, agent.id) == AppVerdict.ALLOWED else lock.unlockedFor(agent.id)
        lease.promptClosed(agent.id, keep = yes)
      }
    }
  }

  // A tap may have moved the screen into an app agents may not use: the
  // result names the app in front (top-level "package"), and then the
  // agent gets the refusal instead of what that app showed.
  private fun shownApp(apps: AppAccess, reply: Reply, agentId: String): Reply {
    if (reply.status != 200) return reply
    val pkg = try {
      JSONObject(reply.body).optJSONObject("data")?.optString("package")
    } catch (_: Exception) {
      null
    }
    return appRefusal(apps, pkg, agentId) ?: reply
  }

  private fun appRefusal(apps: AppAccess, pkg: String?, agentId: String): Reply? {
    val app = pkg?.takeIf { it.isNotBlank() } ?: return null
    return when (apps.verdict(app, agentId)) {
      AppVerdict.ALLOWED -> null
      AppVerdict.BLOCKED -> Reply.appBlocked(app, apps.label(app))
      AppVerdict.ASK -> Reply.appNotAllowed(app, apps.label(app))
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
