package com.phonecando.runner.controllock

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// The three lock modes: how long an unlock lasts and who it lets in.
class ControlLockTest {
  private var now = 0L
  private val store = FakeLockStore()

  private fun lock() = ControlLock(store, AskGrants(300_000) { now })

  @Test fun aFreshInstallStartsLockedInInstallMode() {
    val lock = lock()
    assertEquals(LockMode.INSTALL, lock.mode)
    assertFalse(lock.enabled)
    assertFalse(lock.unlockedFor("a1"))
  }

  @Test fun installModeKeepsTheUnlockAcrossRestarts() {
    assertTrue(lock().unlock())
    assertTrue(store.savedUnlock)
    val restarted = lock()
    assertTrue(restarted.enabled)
    assertTrue(restarted.unlockedFor("a1"))
    assertTrue(restarted.unlockedFor("a2"))
    restarted.lock()
    assertFalse(lock().enabled)
  }

  @Test fun launchModeForgetsItOnRestartAndOnClose() {
    val lock = lock()
    assertTrue(lock.setMode(LockMode.LAUNCH))
    lock.unlock()
    assertTrue(lock.enabled)
    assertFalse(store.savedUnlock)
    assertFalse(lock().enabled)
    lock.appClosed()
    assertFalse(lock.enabled)
  }

  @Test fun closingTheAppLeavesInstallModeUnlocked() {
    val lock = lock()
    lock.unlock()
    lock.appClosed()
    assertTrue(lock.enabled)
  }

  @Test fun askModeUnlocksOnlyTheAskingAgent() {
    val lock = lock()
    lock.setMode(LockMode.ASK)
    // No switch for everyone in ask mode.
    assertFalse(lock.unlock())
    assertFalse(lock.enabled)
    lock.grantAsk("a1")
    assertTrue(lock.unlockedFor("a1"))
    assertFalse(lock.unlockedFor("a2"))
    assertEquals(1, lock.asking)
    lock.endAsk("a1")
    assertFalse(lock.unlockedFor("a1"))
  }

  @Test fun anAskOutsideAskModeUnlocksNothing() {
    val lock = lock()
    lock.grantAsk("a1")
    assertFalse(lock.unlockedFor("a1"))
    assertEquals(0, lock.asking)
  }

  @Test fun lockEndsAskUnlocksToo() {
    val lock = lock()
    lock.setMode(LockMode.ASK)
    lock.grantAsk("a1")
    lock.lock()
    assertFalse(lock.unlockedFor("a1"))
  }

  @Test fun anUnlockCarriesOverBetweenInstallAndLaunch() {
    val lock = lock()
    lock.unlock()
    lock.setMode(LockMode.LAUNCH)
    assertTrue(lock.enabled)
    assertFalse(store.savedUnlock)
    lock.setMode(LockMode.INSTALL)
    assertTrue(lock.enabled)
    assertTrue(store.savedUnlock)
  }

  @Test fun askModeStartsLockedAndLeavingItEndsAsks() {
    val lock = lock()
    lock.unlock()
    lock.setMode(LockMode.ASK)
    assertFalse(lock.enabled)
    assertFalse(store.savedUnlock)
    lock.grantAsk("a1")
    lock.setMode(LockMode.LAUNCH)
    assertFalse(lock.unlockedFor("a1"))
    assertEquals(0, lock.asking)
  }

  @Test fun aModeChangeWithoutAFreshBiometricKeepsTheSavedModeLocked() {
    val lock = lock()
    lock.setMode(LockMode.ASK)
    store.authed = false
    assertFalse(lock.setMode(LockMode.INSTALL))
    assertEquals(LockMode.ASK, lock.mode)
    assertEquals(LockMode.ASK, lock().mode)
  }

  @Test fun theSavedModeIsReadAtStart() {
    store.savedMode = LockMode.LAUNCH
    store.savedUnlock = true
    // Only install mode reads a saved unlock.
    val lock = lock()
    assertEquals(LockMode.LAUNCH, lock.mode)
    assertFalse(lock.enabled)
  }
}
