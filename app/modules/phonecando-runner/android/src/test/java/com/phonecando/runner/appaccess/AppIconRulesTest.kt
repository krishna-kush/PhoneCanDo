package com.phonecando.runner.appaccess

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Where an app's icon is kept, at what size, and when the kept one is drawn again.
class AppIconRulesTest {
  @Test fun oneFilePerPackageAndSize() {
    assertEquals("com.example.bank-96.png", AppIconRules.fileName("com.example.bank", 96))
    assertEquals("com.example.bank-144.png", AppIconRules.fileName("com.example.bank", 144))
  }

  @Test fun theSizeStaysInBounds() {
    assertEquals(AppIconRules.MIN_PX, AppIconRules.sizePx(0))
    assertEquals(AppIconRules.MIN_PX, AppIconRules.sizePx(-5))
    assertEquals(AppIconRules.MAX_PX, AppIconRules.sizePx(100_000))
    assertEquals("com.example.bank-512.png", AppIconRules.fileName("com.example.bank", 9_999))
  }

  @Test fun noPathFromAnythingButAPackageName() {
    assertNull(AppIconRules.fileName("", 96))
    assertNull(AppIconRules.fileName("../../shared_prefs/x", 96))
    assertNull(AppIconRules.fileName("com.example/bank", 96))
    assertNull(AppIconRules.fileName("com.example.bank ", 96))
  }

  @Test fun aKeptIconHoldsUntilTheAppIsUpdated() {
    assertTrue(AppIconRules.fresh(length = 2_000, modifiedMs = 200, appUpdatedMs = 100))
    assertTrue(AppIconRules.fresh(length = 2_000, modifiedMs = 100, appUpdatedMs = 100))
    assertFalse(AppIconRules.fresh(length = 2_000, modifiedMs = 99, appUpdatedMs = 100))
    // Missing or empty: drawn again.
    assertFalse(AppIconRules.fresh(length = 0, modifiedMs = 0, appUpdatedMs = 100))
    assertFalse(AppIconRules.fresh(length = 0, modifiedMs = 500, appUpdatedMs = 100))
  }
}
