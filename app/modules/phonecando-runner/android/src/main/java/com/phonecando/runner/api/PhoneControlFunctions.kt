package com.phonecando.runner.api

import android.content.Context
import com.phonecando.runner.bridge.Bridge
import com.phonecando.runner.controllock.ControlLocks
import com.phonecando.runner.controllock.LockMode
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

// The phone-control lock, for the app's Settings and unlock dialog
// (controllock/ControlLock). Only the app calls these, each unlock or mode
// change right after the user's biometric; no agent process can reach
// them. Full builds only use them: lite and play have no lock.
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
}
