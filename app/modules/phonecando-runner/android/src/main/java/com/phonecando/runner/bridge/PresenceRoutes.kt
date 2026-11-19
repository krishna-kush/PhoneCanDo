package com.phonecando.runner.bridge

import com.phonecando.runner.presence.Focus
import com.phonecando.runner.presence.HandMode
import com.phonecando.runner.presence.HandsText
import com.phonecando.runner.presence.PresenceStore
import com.phonecando.runner.presence.StatusRules
import org.json.JSONObject

// The agent's side of its presence (presence/): handing you the controls,
// waiting for them back, its status line, and where you are looking.
//   /hands/over {why, private?}   WATCH: blocks until you hand them back or
//                                 WAIT_MAX_MS, {mode:"watch", back}; private:
//                                 at once, {mode:"private", back:false, message}
//   /hands/wait {timeoutSec?}     {back, mode?}: blocks while you have the
//                                 controls in WATCH (Let me), until you hand
//                                 them back or its time is up; back true at
//                                 once when none is the caller's; stopped
//                                 (Stop), at once with message: end the turn
// Let me is a pause: a wait that runs out says to call it again (one call
// per WAIT_MAX_MS, the same turn). Stop really stops: the note sends the
// agent on when you start it again.
//   /status {text, mood?}         {shown:true}; an empty text clears it
//   /focus {}                     {app, onScreen, phone} (Focus)
// /hands/* are full only, gated, and /hands/over is a screen route (the
// caller holds the screen or takes a free one; one already on is 409
// user_has_controls in the router). A wait blocks on the request's own
// thread. A missing or mistyped argument is 400 bad_request. Pure: the
// store and the phone's facts are injected.
class PresenceRoutes(
  private val store: PresenceStore,
  private val facts: () -> Focus.Facts,
  private val waitMaxMs: Long = WAIT_MAX_MS,
) {
  fun table(): Map<Route, RouteHandler> = mapOf(
    Route.HANDS_OVER to ::handOver,
    Route.HANDS_WAIT to ::waitForUser,
    Route.STATUS to ::status,
    Route.FOCUS to ::focus,
  )

  private fun handOver(call: BridgeCall): Reply {
    val why = when (val w = call.body.opt("why")) {
      is String -> w.replace(LINE_BREAKS, " ").trim()
      null, JSONObject.NULL -> ""
      else -> return wrongType("why")
    }
    if (why.isEmpty()) return Reply.badRequest(BAD, "why is required: one short line the user sees, why you need them")
    if (why.length > WHY_MAX) return Reply.badRequest(BAD, "why is ${why.length} characters, over $WHY_MAX")
    val private = when (val p = call.body.opt("private")) {
      is Boolean -> p
      null, JSONObject.NULL -> false
      else -> return wrongType("private")
    }
    val started = store.agent(call.agent.id, call.agent.name, why, private)
      ?: return Reply.userHasControls(HandsText.USER_HAS_CONTROLS)
    if (started.mode == HandMode.PAUSED) return Reply.ok(paused(HandsText.HANDED_PRIVATE))
    // A watch hand-over waits here for you, as a first /hands/wait would.
    return when (store.await(call.agent.id, waitMaxMs)) {
      PresenceStore.Wait.BACK -> Reply.ok(JSONObject().put("mode", "watch").put("back", true))
      PresenceStore.Wait.WATCH -> Reply.ok(stillYours().put("mode", "watch"))
      PresenceStore.Wait.PAUSED -> Reply.ok(paused(HandsText.PAUSED))
    }
  }

  private fun waitForUser(call: BridgeCall): Reply {
    val ms = when (val t = call.body.opt("timeoutSec")) {
      null, JSONObject.NULL -> waitMaxMs
      is Number -> t.toDouble().takeIf { it.isFinite() }?.let { (it * 1_000).toLong().coerceIn(1_000, maxOf(waitMaxMs, 1_000)) }
        ?: return wrongType("timeoutSec")
      else -> return wrongType("timeoutSec")
    }
    return when (store.await(call.agent.id, ms)) {
      PresenceStore.Wait.BACK -> Reply.ok(JSONObject().put("back", true))
      PresenceStore.Wait.WATCH -> Reply.ok(stillYours().put("mode", "watch"))
      PresenceStore.Wait.PAUSED -> Reply.ok(paused(HandsText.PAUSED))
    }
  }

  private fun status(call: BridgeCall): Reply {
    val text = call.body.opt("text") as? String ?: return Reply.badRequest(BAD, "text is required: a few words, or \"\" to clear it")
    val mood = when (val m = call.body.opt("mood")) {
      null, JSONObject.NULL -> StatusRules.mood(null)
      is String -> StatusRules.mood(m)
      else -> null
    } ?: return Reply.badRequest(BAD, "mood must be working, thinking or waiting")
    store.status(call.agent.id, text, mood)
    return Reply.ok(JSONObject().put("shown", true))
  }

  private fun focus(call: BridgeCall): Reply {
    val seen = Focus.of(facts(), call.agent.id)
    return Reply.ok(
      JSONObject().put("app", seen.app).put("onScreen", seen.onScreen ?: JSONObject.NULL).put("phone", seen.phone),
    )
  }

  private fun stillYours() = JSONObject().put("back", false).put("message", HandsText.STILL_YOURS)

  private fun paused(message: String) = JSONObject().put("mode", "private").put("back", false).put("message", message)

  private fun wrongType(key: String) = Reply.badRequest(BAD, "$key has the wrong type")

  companion object {
    /**
     * The longest a hand-over call waits for you: long enough that an agent
     * waits for you in one call, and under the MCP clients' tool timeouts
     * (some cut a call off at five minutes; our kinds' manifests raise the
     * shorter ones to that).
     */
    const val WAIT_MAX_MS = 240_000L
    const val WHY_MAX = 120
    private const val BAD = "bad_request"
    private val LINE_BREAKS = Regex("[\\r\\n\\t]+")
  }
}
