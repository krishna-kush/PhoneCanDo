package com.phonecando.runner.appaccess

import com.phonecando.runner.appaccess.AppGate.Shot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// One screen call's check inside the PCE: each look and action judged
// again, the first app refused kept for the router, which parts of other
// apps a look shows, and when a screenshot may be taken.
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

  @Test fun aPartShowsOnlyWhenEveryAppWithItsNameIsAllowed() {
    val gate = access.gate("a1")
    val widget = ForeignParts.Part("3", ForeignParts.Kind.WIDGET, listOf(bank), null)
    assertFalse(gate.mayShow(widget))
    gate.hid(widget)
    assertEquals(listOf(AppGate.Hidden(bank, "Name of $bank", "widget")), gate.hidden)
    // Leaving a part out refuses nothing.
    assertNull(gate.refused)
    access.setAlways(notes)
    val shared = ForeignParts.Part("r", ForeignParts.Kind.NOTIFICATION, listOf(notes, mail), "Notes")
    assertFalse(gate.mayShow(shared))
    access.setAlways(mail)
    assertTrue(gate.mayShow(shared))
    // A name no app has never shows.
    assertFalse(gate.mayShow(ForeignParts.Part("s", ForeignParts.Kind.NOTIFICATION, emptyList(), "Shell")))
  }

  @Test fun aTapOnAHiddenPartIsRefusedByItsApp() {
    val gate = access.gate("a1")
    assertFalse(gate.mayTap(ForeignParts.Part("r", ForeignParts.Kind.NOTIFICATION, listOf(bank), "Bank")))
    assertEquals(bank, gate.refused)
    // One nobody can name: its name, for the router.
    val other = access.gate("a1")
    assertFalse(other.mayTap(ForeignParts.Part("s", ForeignParts.Kind.NOTIFICATION, emptyList(), "Shell")))
    assertNull(other.refused)
    assertEquals("Shell", other.refusedUnnamed)
    // Allowed since: the tap goes on.
    access.grantOnce("a1", bank)
    assertTrue(access.gate("a1").mayTap(ForeignParts.Part("r", ForeignParts.Kind.NOTIFICATION, listOf(bank), "Bank")))
  }

  @Test fun noScreenshotOfTheHomeScreen() {
    assertEquals(Shot.WITHHOLD, access.gate("a1").shot(HOME, listOf(HOME)))
    // An app it may not use on screen still refuses the look, so it can ask.
    assertEquals(Shot.REFUSE, access.gate("a1").shot(HOME, listOf(HOME, bank)))
  }
}
