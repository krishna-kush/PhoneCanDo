package com.phonecando.runner.appaccess

import com.phonecando.runner.appaccess.AppGate.Shot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// One screen call's check inside the PCE: each look and action judged
// again, the first app refused kept for the router, and when a screenshot
// may be taken.
class AppGateTest {
  private val bank = "com.example.bank"
  private val mail = "com.example.mail"
  private val notes = "com.example.notes"
  private val access = AppAccess(FakeAppAccessStore(), { it == OWN || it == HOME }, { "Name of $it" }) { it == HOME }

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

  @Test fun aScreenshotNeedsEveryAppOnScreen() {
    access.setAlways(notes)
    assertEquals(Shot.TAKE, access.gate("a1").shot(notes, listOf(notes)))
    assertEquals(Shot.TAKE, access.gate("a1").shot(OWN, listOf(OWN, null)))
    // The other half of a split screen, or a picture-in-picture.
    val gate = access.gate("a1")
    assertEquals(Shot.REFUSE, gate.shot(notes, listOf(notes, bank)))
    assertEquals(bank, gate.refused)
    // The app in front itself.
    assertEquals(Shot.REFUSE, access.gate("a1").shot(mail, listOf(mail)))
  }

  @Test fun noScreenshotOfTheHomeScreen() {
    assertEquals(Shot.WITHHOLD, access.gate("a1").shot(HOME, listOf(HOME)))
    // An app it may not use on screen still refuses the look, so it can ask.
    assertEquals(Shot.REFUSE, access.gate("a1").shot(HOME, listOf(HOME, bank)))
  }
}
