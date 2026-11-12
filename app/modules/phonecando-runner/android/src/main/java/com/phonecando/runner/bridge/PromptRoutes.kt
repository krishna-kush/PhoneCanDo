package com.phonecando.runner.bridge

import android.content.Context
import com.phonecando.runner.AutomationHost
import com.phonecando.runner.RestrictedSettings
import com.phonecando.runner.controllock.ControlLock
import org.json.JSONObject

// /unlock and /accessibility (full builds only, ungated: both are safe while
// phone control is locked). Each asks the app to show its dialog over the
// chat for this request alone and blocks until the user is done, so the
// agent continues in the same turn (PromptFlows has the waits).
class PromptRoutes(
  private val context: Context,
  private val flows: PromptFlows,
  private val automation: () -> AutomationHost?,
  private val lock: ControlLock,
) {
  fun table(): Map<Route, RouteHandler> = mapOf(
    Route.UNLOCK to { call -> unlock(call) },
    Route.ACCESSIBILITY to { call -> accessibility(call) },
  )

  // The app's biometric/PIN modal is the only place the lock opens; the
  // agent never sees or supplies a credential. In ask mode the user's yes
  // is this agent's own unlock (ControlLock.grantAsk).
  private fun unlock(call: BridgeCall): Reply {
    val waitMs = call.body.optLong("waitMs", 45_000).coerceIn(5_000, 90_000)
    val agentId = call.agent.id
    val out = flows.unlock(call.agent, "phone_control", waitMs) { lock.unlockedFor(agentId) }
    if (out.requested && out.unlocked) lock.grantAsk(agentId)
    return Reply.ok(
      JSONObject().put("requested", out.requested).put("unlocked", out.unlocked).put("notified", out.notified),
    )
  }

  // Waits for PhoneCanDo's service to connect; the guide's three steps fit
  // in the default wait, which stays under five minutes, where common HTTP
  // clients give up on a response. `restricted` is "sideload" when the user
  // went through the app's restricted-settings guide, otherwise the native
  // best guess (RestrictedSettings.state).
  private fun accessibility(call: BridgeCall): Reply {
    val waitMs = call.body.optLong("waitMs", 240_000).coerceIn(30_000, 280_000)
    val out = flows.accessibility(call.agent, "accessibility", waitMs) { automation()?.connected == true }
    val restricted = when {
      out.guided -> RestrictedSettings.SIDELOAD
      out.enabled -> RestrictedSettings.NONE
      else -> RestrictedSettings.state(context)
    }
    return Reply.ok(
      JSONObject()
        .put("opened", out.opened)
        .put("enabled", out.enabled)
        .put("cancelled", out.cancelled)
        .put("notified", out.notified)
        .put("restricted", restricted),
    )
  }
}
