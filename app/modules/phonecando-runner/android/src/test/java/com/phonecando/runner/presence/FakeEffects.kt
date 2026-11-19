package com.phonecando.runner.presence

import com.phonecando.runner.bridge.ScreenLease

// What a PresenceStore asked of the world, in order.
class FakeEffects(var target: ScreenLease.Seat? = ScreenLease.Seat("a1", "opencode")) : PresenceStore.Effects {
  val log = mutableListOf<String>()
  var changes = 0

  override fun target(): ScreenLease.Seat? = target

  override fun freeze(seat: ScreenLease.Seat) {
    log += "freeze ${seat.agentId}"
  }

  override fun thaw(agentId: String, giveBack: Boolean) {
    log += if (giveBack) "thaw $agentId, give back" else "thaw $agentId"
  }

  override fun stopTurn(agentId: String) {
    log += "stop $agentId"
  }

  override fun resume(agentId: String, after: HandMode) {
    log += "resume $agentId after ${after.name.lowercase()}"
  }

  override fun changed() {
    changes++
  }
}
