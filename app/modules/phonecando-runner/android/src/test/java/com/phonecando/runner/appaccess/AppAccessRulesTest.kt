package com.phonecando.runner.appaccess

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// The verdict order, one branch at a time, and what counts as a package.
class AppAccessRulesTest {
  private val bank = "com.example.bank"

  private fun verdict(
    pkg: String? = bank,
    exempt: Set<String> = setOf(OWN, HOME),
    blocked: Set<String> = emptySet(),
    allowAll: Boolean = false,
    always: Set<String> = emptySet(),
    justNow: Set<String> = emptySet(),
  ) = AppAccessRules.verdict(pkg, { it in exempt }, blocked, allowAll, always, justNow)

  @Test fun noPackagePasses() {
    assertEquals(AppVerdict.ALLOWED, verdict(pkg = null, blocked = setOf(bank)))
    assertEquals(AppVerdict.ALLOWED, verdict(pkg = "", blocked = setOf(bank)))
    assertEquals(AppVerdict.ALLOWED, verdict(pkg = "  "))
  }

  @Test fun phoneCanDoAndTheHomeScreenAreNeverAskedAbout() {
    assertEquals(AppVerdict.ALLOWED, verdict(pkg = OWN))
    // Even a forged "No" for them does not count.
    assertEquals(AppVerdict.ALLOWED, verdict(pkg = HOME, blocked = setOf(HOME)))
  }

  @Test fun aNoHoldsOverEverything() {
    assertEquals(
      AppVerdict.BLOCKED,
      verdict(blocked = setOf(bank), allowAll = true, always = setOf(bank), justNow = setOf(bank)),
    )
  }

  @Test fun allowAllLetsEveryOtherAppIn() {
    assertEquals(AppVerdict.ALLOWED, verdict(allowAll = true))
  }

  @Test fun alwaysLetsItIn() {
    assertEquals(AppVerdict.ALLOWED, verdict(always = setOf(bank)))
  }

  @Test fun justNowLetsItIn() {
    assertEquals(AppVerdict.ALLOWED, verdict(justNow = setOf(bank)))
  }

  @Test fun anythingElseAsks() {
    assertEquals(AppVerdict.ASK, verdict(always = setOf("com.other"), justNow = setOf("com.other")))
    // Android's own Settings and System UI are asked about too.
    assertEquals(AppVerdict.ASK, verdict(pkg = "com.android.settings"))
    assertEquals(AppVerdict.ASK, verdict(pkg = "com.android.systemui"))
  }

  @Test fun packageNames() {
    assertTrue(AppAccessRules.isPackageName("com.example.bank"))
    assertTrue(AppAccessRules.isPackageName("android"))
    assertTrue(AppAccessRules.isPackageName("com.app_2.x"))
    assertFalse(AppAccessRules.isPackageName(""))
    assertFalse(AppAccessRules.isPackageName("com..bank"))
    assertFalse(AppAccessRules.isPackageName("1com.bank"))
    assertFalse(AppAccessRules.isPackageName("Allow every app"))
    assertFalse(AppAccessRules.isPackageName("com.bank."))
    assertFalse(AppAccessRules.isPackageName("a." + "b".repeat(255)))
  }
}
