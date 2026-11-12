package com.phonecando.runner.bridge

import com.phonecando.runner.engine.work.KeepAsks
import com.phonecando.runner.engine.work.WorkRules
import org.json.JSONObject
import java.time.Instant

// agents_keep_running's route: the calling agent asks to stay up while idle
// in the background, or takes its ask back (engine/work/KeepAsks). On every
// channel, neither gated nor a screen route: it changes nothing on the
// phone but whether the runner stops this agent for being idle.
//   /keep {on, reason?, minutes?}   {on, reason, minutes, until, userKeepsRunning} or {on: false, userKeepsRunning}
// on:true needs a reason (the user sees it in the notification) and lasts
// minutes (ASK_DEFAULT_MINUTES when absent, cut to 1..ASK_MAX_MINUTES); a
// new ask replaces the last. until is ISO-8601 UTC. userKeepsRunning: the
// user's Keep running switch is on, so the agent needs no ask. [changed]
// tells the work watch to look now (the notification shows the ask). A
// missing or mistyped argument is 400 bad_request. Pure.
class KeepRoutes(
  private val asks: KeepAsks,
  private val userKeeps: (agentId: String) -> Boolean,
  private val changed: () -> Unit,
) {
  fun table(): Map<Route, RouteHandler> = mapOf(Route.KEEP to ::keep)

  private fun keep(call: BridgeCall): Reply {
    val on = call.body.opt("on") as? Boolean
      ?: return Reply.badRequest(BAD, "on is required: true to stay up, false to end your ask")
    val id = call.agent.id
    if (!on) {
      asks.clear(id)
      changed()
      return Reply.ok(JSONObject().put("on", false).put("userKeepsRunning", userKeeps(id)))
    }
    val reason = when (val r = call.body.opt("reason")) {
      is String -> r.takeIf { it.isNotBlank() }
      null, JSONObject.NULL -> null
      else -> return wrongType("reason")
    } ?: return Reply.badRequest(BAD, "reason is required with on: true: what you stay up for, shown to the user")
    val minutes = when (val m = call.body.opt("minutes")) {
      null, JSONObject.NULL -> WorkRules.ASK_DEFAULT_MINUTES
      is Number -> m.toDouble().takeIf { it.isFinite() }?.toInt()?.coerceIn(1, WorkRules.ASK_MAX_MINUTES)
        ?: return wrongType("minutes")
      else -> return wrongType("minutes")
    }
    val ask = asks.ask(id, reason, minutes)
    changed()
    return Reply.ok(
      JSONObject()
        .put("on", true)
        .put("reason", ask.reason)
        .put("minutes", minutes)
        .put("until", Instant.ofEpochMilli(ask.until).toString())
        .put("userKeepsRunning", userKeeps(id)),
    )
  }

  private fun wrongType(key: String) = Reply.badRequest(BAD, "$key has the wrong type")

  private companion object {
    const val BAD = "bad_request"
  }
}
