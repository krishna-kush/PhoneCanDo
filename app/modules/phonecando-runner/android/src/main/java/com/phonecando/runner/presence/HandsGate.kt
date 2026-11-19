package com.phonecando.runner.presence

import com.phonecando.runner.bridge.Route

// What a screen request gets while you have the controls (BridgeRouter,
// after the lock and service checks, before the lease):
//   the hand-over's agent, PAUSED     every screen route: paused_by_user (end the turn; a repeat stops it)
//   the hand-over's agent, WATCH      /pce/observe passes (it may follow along); any other: user_has_controls
//   any other agent                   every screen route: user_has_controls
// Routes that leave the screen alone, /hands/wait among them, always pass.
// Pure.
object HandsGate {
  enum class Refusal { USER_HAS_CONTROLS, PAUSED_BY_USER }

  fun check(agentId: String, route: Route, handOver: HandOver?): Refusal? {
    val on = handOver ?: return null
    if (!route.screen) return null
    if (on.agentId != agentId) return Refusal.USER_HAS_CONTROLS
    return when (on.mode) {
      HandMode.PAUSED -> Refusal.PAUSED_BY_USER
      HandMode.WATCH -> if (route == Route.PCE_OBSERVE) null else Refusal.USER_HAS_CONTROLS
    }
  }
}
