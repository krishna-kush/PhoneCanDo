package com.phonecando.runner.controllock

// Who may use phone control now (the bridge's 403 automation_off), by the
// user's lock mode. Install and launch modes have one switch for the phone:
// the user's unlock lets every running agent in, and install mode keeps it
// across restarts through the store. Ask mode has no switch: each agent
// gets its own unlock when the user says yes to its ask (AskGrants). Only
// the app's UI unlocks or changes the mode, each right after the user's
// biometric or PIN; no agent call reaches those. Pure: the store and the
// grants are injected.
class ControlLock(private val store: LockStore, private val grants: AskGrants) {
  @Volatile
  var mode: LockMode = store.loadMode()
    private set

  /** Install and launch modes: unlocked for every agent. Never on in ask mode. */
  @Volatile
  var enabled: Boolean = mode == LockMode.INSTALL && store.hasSavedUnlock()
    private set

  /** Ask mode: how many agents hold an unlock. */
  val asking: Int get() = grants.count()

  /** `use`: a phone-control call goes through, which restarts an ask unlock's idle time. */
  fun unlockedFor(agentId: String, use: Boolean = false): Boolean =
    if (mode == LockMode.ASK) grants.allows(agentId, use) else enabled

  // The user's unlock, right after the biometric. Install mode also saves
  // it; when the save fails it still holds until the process ends. False
  // in ask mode, where only an agent's ask unlocks (grantAsk).
  @Synchronized
  fun unlock(): Boolean {
    if (mode == LockMode.ASK) return false
    enabled = true
    if (mode == LockMode.INSTALL) store.saveUnlock()
    return true
  }

  /** Locks every agent out, ask unlocks included, and forgets a saved unlock. */
  @Synchronized
  fun lock() {
    enabled = false
    grants.clear()
    store.dropUnlock()
  }

  // A new mode, right after the user's biometric. An unlock carries over
  // between install and launch (install saves it, launch forgets it); ask
  // mode starts locked, and leaving it ends every ask unlock. When the save
  // fails, this falls back to whatever mode the store reads, locked.
  @Synchronized
  fun setMode(next: LockMode): Boolean {
    if (!store.saveMode(next)) {
      mode = store.loadMode()
      lock()
      return false
    }
    mode = next
    when (next) {
      LockMode.INSTALL -> if (enabled) store.saveUnlock()
      LockMode.LAUNCH -> store.dropUnlock()
      LockMode.ASK -> {
        enabled = false
        store.dropUnlock()
      }
    }
    if (next != LockMode.ASK) grants.clear()
    return true
  }

  /** Ask mode: the user said yes to this agent's ask. A no-op in the other modes. */
  fun grantAsk(agentId: String) {
    if (mode == LockMode.ASK) grants.grant(agentId)
  }

  /** The agent handed the phone back or its engine stopped. */
  fun endAsk(agentId: String) = grants.end(agentId)

  fun endAsks() = grants.clear()

  /** The user closed PhoneCanDo (swiped it from recent apps): launch mode locks. */
  @Synchronized
  fun appClosed() {
    if (mode == LockMode.LAUNCH) enabled = false
  }
}
