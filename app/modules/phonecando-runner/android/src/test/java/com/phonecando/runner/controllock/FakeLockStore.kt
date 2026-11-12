package com.phonecando.runner.controllock

// The Keystore store's contract in memory: saves work only while `authed`
// (the user has just authenticated).
class FakeLockStore(
  var savedMode: LockMode? = null,
  var savedUnlock: Boolean = false,
  var authed: Boolean = true,
) : LockStore {
  override fun loadMode(): LockMode = savedMode ?: LockMode.DEFAULT

  override fun saveMode(mode: LockMode): Boolean {
    if (!authed) return false
    savedMode = mode
    return true
  }

  override fun hasSavedUnlock(): Boolean = savedUnlock

  override fun saveUnlock(): Boolean {
    if (!authed) return false
    savedUnlock = true
    return true
  }

  override fun dropUnlock() {
    savedUnlock = false
  }
}

/** An install-mode lock the user has unlocked, for tests about what comes after the lock. */
fun unlockedLock(clock: () -> Long = { 0L }): ControlLock =
  ControlLock(FakeLockStore(), AskGrants(300_000, clock)).also { it.unlock() }
