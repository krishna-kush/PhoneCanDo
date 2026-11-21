package com.phonecando.runner.appaccess

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// One screen call's check inside the PCE: each look and action judged
// again, and the first app refused kept for the router.
class AppGateTest {
  private val bank = "com.example.bank"
  private val mail = "com.example.mail"
  private val access = AppAccess(FakeAppAccessStore(), { it == OWN || it == HOME }, { "Name of $it" })

  @Test fun theFirstAppRefusedAnswersForTheCall() {
    val gate = access.gate("a1")
    assertTrue(gate.allows(HOME))
    assertTrue(gate.allows(null))
    assertNull(gate.refused)
    assertFalse(gate.allows(bank))
    assertFalse(gate.allows(mail))
    assertEquals(bank, gate.refused)
  }

  @Test fun itJudgesByTheCallersOwnAnswers() {
    access.grantOnce("a1", bank)
    assertTrue(access.gate("a1").allows(bank))
    assertFalse(access.gate("a2").allows(bank))
    // An answer given while the call runs counts at once.
    val gate = access.gate("a2")
    access.setAlways(bank)
    assertTrue(gate.allows(bank))
  }
}
