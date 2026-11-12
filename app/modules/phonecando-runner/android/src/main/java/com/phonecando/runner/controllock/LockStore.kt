package com.phonecando.runner.controllock

/** Where the lock mode and an install-mode unlock outlive the process. */
interface LockStore {
  /** The saved mode: DEFAULT when none was saved, STRICTEST when it does not check out. */
  fun loadMode(): LockMode

  /** Saves [mode]; only works right after the user's biometric or PIN. */
  fun saveMode(mode: LockMode): Boolean

  /** An unlock saved by [saveUnlock] that checks out. */
  fun hasSavedUnlock(): Boolean

  /** Keeps the unlock across restarts; only works right after the user's biometric or PIN. */
  fun saveUnlock(): Boolean

  fun dropUnlock()
}
