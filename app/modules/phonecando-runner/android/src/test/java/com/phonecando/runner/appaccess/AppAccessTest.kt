package com.phonecando.runner.appaccess

import com.phonecando.runner.appaccess.AppAccess.Entry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// The answers as the app and the bridge change them: what needs the
// biometric, what lifts what, and what the Settings list shows.
class AppAccessTest {
  private val bank = "com.example.bank"
  private val store = FakeAppAccessStore()

  @Test fun savedAnswersAreReadAtStart() {
    val access = appAccess(FakeAppAccessStore(always = mutableSetOf(bank), blocked = setOf("com.notes")))
    assertEquals(AppVerdict.ALLOWED, access.verdict(bank, "a1"))
    assertEquals(AppVerdict.BLOCKED, access.verdict("com.notes", "a1"))
    assertEquals(AppVerdict.ASK, access.verdict("com.other", "a1"))
  }

  @Test fun alwaysNeedsTheBiometric() {
    val access = appAccess(store)
    store.authed = false
    assertFalse(access.setAlways(bank))
    assertEquals(AppVerdict.ASK, access.verdict(bank, "a1"))
    store.authed = true
    assertTrue(access.setAlways(bank))
    assertEquals(AppVerdict.ALLOWED, access.verdict(bank, "a2"))
    assertEquals(setOf(bank), store.always)
  }

  @Test fun alwaysLiftsANo() {
    val access = appAccess(store)
    access.block(bank)
    assertTrue(access.setAlways(bank))
    assertEquals(AppVerdict.ALLOWED, access.verdict(bank, "a1"))
    assertEquals(emptySet<String>(), store.blocked)
  }

  @Test fun justNowIsTheAgentsOwnUntilItEnds() {
    val access = appAccess(store)
    access.grantOnce("a1", bank)
    assertEquals(AppVerdict.ALLOWED, access.verdict(bank, "a1"))
    assertEquals(AppVerdict.ASK, access.verdict(bank, "a2"))
    access.endJustNow("a1")
    assertEquals(AppVerdict.ASK, access.verdict(bank, "a1"))
    access.grantOnce("a1", bank)
    access.grantOnce("a2", bank)
    access.endAllJustNow()
    assertEquals(AppVerdict.ASK, access.verdict(bank, "a1"))
    assertEquals(AppVerdict.ASK, access.verdict(bank, "a2"))
    // Never saved.
    assertTrue(store.always.isEmpty())
  }

  @Test fun noBlocksEveryAgentAndDropsTheirYeses() {
    val access = appAccess(store)
    access.setAlways(bank)
    access.grantOnce("a1", bank)
    store.authed = false
    access.block(bank)
    assertEquals(AppVerdict.BLOCKED, access.verdict(bank, "a1"))
    assertEquals(setOf(bank), store.blocked)
    assertTrue(store.always.isEmpty())
    // Taken off the list again, the earlier Just now does not come back.
    access.forget(bank)
    assertEquals(AppVerdict.ASK, access.verdict(bank, "a1"))
  }

  @Test fun forgetTakesItOffBothListsWithoutTheBiometric() {
    val access = appAccess(store)
    access.setAlways(bank)
    access.block("com.notes")
    store.authed = false
    access.forget(bank)
    access.forget("com.notes")
    assertEquals(AppVerdict.ASK, access.verdict(bank, "a1"))
    assertEquals(AppVerdict.ASK, access.verdict("com.notes", "a1"))
    assertTrue(store.always.isEmpty())
    assertTrue(store.blocked.isEmpty())
  }

  @Test fun allowAllOnNeedsTheBiometricOffNeedsNothing() {
    val access = appAccess(store)
    store.authed = false
    assertFalse(access.setAllowAll(true))
    assertEquals(AppVerdict.ASK, access.verdict(bank, "a1"))
    store.authed = true
    assertTrue(access.setAllowAll(true))
    assertEquals(AppVerdict.ALLOWED, access.verdict(bank, "a1"))
    store.authed = false
    assertFalse(access.setAllowAll(false))
    assertFalse(store.allowAll)
    assertEquals(AppVerdict.ASK, access.verdict(bank, "a1"))
  }

  @Test fun allowAllLeavesANoStanding() {
    val access = appAccess(store)
    access.block(bank)
    access.setAllowAll(true)
    assertEquals(AppVerdict.BLOCKED, access.verdict(bank, "a1"))
    assertEquals(AppVerdict.ALLOWED, access.verdict("com.other", "a1"))
  }

  // Allow all's record signs the No list it was turned on over.

  @Test fun aNoTakenOffBehindOurBackTurnsAllowAllOff() {
    val notes = "com.notes"
    val signed = FakeAppAccessStore(blocked = setOf(bank, notes), allowAllOver = setOf(bank, notes))
    assertTrue(appAccess(signed).allowAll)
    // The No for the bank deleted from the app's files: after a restart,
    // everything asks again instead of the bank getting in.
    signed.blocked = setOf(notes)
    val restarted = appAccess(signed)
    assertFalse(restarted.allowAll)
    assertEquals(AppVerdict.ASK, restarted.verdict(bank, "a1"))
    assertEquals(AppVerdict.ASK, restarted.verdict("com.other", "a1"))
    // A No added behind our back fails the same way, closed.
    signed.blocked = setOf(bank, notes, "com.extra")
    assertFalse(appAccess(signed).allowAll)
  }

  @Test fun aNoWithTheBiometricKeepsAllowAllOn() {
    val access = appAccess(store)
    access.setAllowAll(true)
    access.block(bank)
    assertTrue(access.allowAll)
    assertEquals(setOf(bank), store.allowAllOver)
    val restarted = appAccess(store)
    assertTrue(restarted.allowAll)
    assertEquals(AppVerdict.BLOCKED, restarted.verdict(bank, "a1"))
    assertEquals(AppVerdict.ALLOWED, restarted.verdict("com.other", "a1"))
  }

  @Test fun aNoWithoutTheBiometricStillHoldsAndTurnsAllowAllOff() {
    val access = appAccess(store)
    access.setAllowAll(true)
    store.authed = false
    access.block(bank)
    assertEquals(AppVerdict.BLOCKED, access.verdict(bank, "a1"))
    assertFalse(access.allowAll)
    assertFalse(store.allowAll)
    assertEquals(AppVerdict.ASK, access.verdict("com.other", "a1"))
    assertFalse(appAccess(store).allowAll)
    // Blocking it again changes nothing.
    store.authed = true
    access.setAllowAll(true)
    store.authed = false
    access.block(bank)
    assertTrue(access.allowAll)
  }

  @Test fun liftingANoUnderAllowAllNeedsTheBiometric() {
    val access = appAccess(store)
    access.setAllowAll(true)
    access.block(bank)
    store.authed = false
    assertFalse(access.forget(bank))
    assertFalse(access.setAlways(bank))
    assertEquals(AppVerdict.BLOCKED, access.verdict(bank, "a1"))
    assertEquals(setOf(bank), store.blocked)
    assertEquals(setOf(bank), store.allowAllOver)
    assertTrue(access.allowAll)
    store.authed = true
    assertTrue(access.forget(bank))
    assertEquals(AppVerdict.ALLOWED, access.verdict(bank, "a1"))
    assertEquals(emptySet<String>(), store.allowAllOver)
  }

  @Test fun alwaysLiftsANoUnderAllowAllInTheSameWindow() {
    val access = appAccess(store)
    access.setAllowAll(true)
    access.block(bank)
    assertTrue(access.setAlways(bank))
    assertEquals(emptySet<String>(), store.blocked)
    assertEquals(emptySet<String>(), store.allowAllOver)
    assertEquals(setOf(bank), store.always)
    assertTrue(appAccess(store).allowAll)
  }

  @Test fun theListIsByLabelBlockedOverAlways() {
    val access = AppAccess(
      FakeAppAccessStore(always = mutableSetOf("com.z", "com.b"), blocked = setOf("com.a", "com.b")),
      { false },
      mapOf("com.z" to "alpha", "com.b" to "Bravo", "com.a" to "Charlie")::getValue,
    )
    assertEquals(
      listOf(Entry("com.z", "alpha", "always"), Entry("com.b", "Bravo", "blocked"), Entry("com.a", "Charlie", "blocked")),
      access.entries(),
    )
  }
}
