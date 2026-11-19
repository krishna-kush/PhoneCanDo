package com.phonecando.runner.api

import android.content.Context
import com.phonecando.runner.autooff.AutoOff
import com.phonecando.runner.bridge.Bridge
import com.phonecando.runner.controllock.ControlLocks
import com.phonecando.runner.controllock.LockMode
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

// The phone-control lock, for the app's Settings and unlock dialog
// (controllock/ControlLock). Only the app calls these, each unlock or mode
// change right after the user's biometric; no agent process can reach
// them. And Auto off (autooff/), which turns the accessibility service off
// while nobody needs it, so payment apps open. Full builds only use them:
// lite and play have no lock and no service.
internal fun ModuleDefinitionBuilder.phoneControlFunctions(context: () -> Context) {
  // "install" | "launch" | "ask".
  Function("getLockMode") {
    ControlLocks.get(context()).mode.wire
  }

  // Right after the user's biometric; false when the mode is unknown or
  // could not be saved (then the saved mode stands, locked).
  Function("setLockMode") { wire: String ->
    val mode = LockMode.fromWire(wire) ?: return@Function false
    ControlLocks.get(context()).setMode(mode)
  }

  // Install and launch modes: unlock (right after the user's biometric) or
  // lock every agent; locking also ends ask-mode unlocks. Answers whether
  // it is now unlocked; an unlock in ask mode is refused.
  Function("setAutomationEnabled") { enabled: Boolean ->
    val lock = ControlLocks.get(context())
    if (enabled) lock.unlock() else lock.lock()
    lock.enabled
  }

  // Unlocked for every agent (install and launch modes).
  Function("isAutomationEnabled") {
    ControlLocks.get(context()).enabled
  }

  // Ask mode: how many agents hold their own unlock.
  Function("askUnlockCount") {
    ControlLocks.get(context()).asking
  }

  // An agent is driving the screen right now (the bridge's screen lease).
  Function("isPhoneInUse") {
    Bridge.screenInUse()
  }

  Function("getAutoOff") {
    AutoOff.isOn(context())
  }

  // Returns the switch as kept, and answers the offer. The service's watch
  // reads it at its next look.
  Function("setAutoOff") { on: Boolean ->
    val ctx = context()
    AutoOff.set(ctx, on)
    AutoOff.isOn(ctx)
  }

  // Auto off turned the service off and it has not run since.
  Function("wasAutoOff") {
    AutoOff.turnedOff(context())
  }

  // The switch came on for the first time on this install and Auto off's
  // offer is not answered yet.
  Function("autoOffOfferDue") {
    AutoOff.offerDue(context())
  }

  // "Stay on duty": the offer is answered, Auto off stays as it is.
  Function("dropAutoOffOffer") {
    AutoOff.dropOffer(context())
  }
}
