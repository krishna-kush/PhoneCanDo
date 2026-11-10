package com.phonecando.agents.kit.term

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// JVM checks for TermReplies: the support query's answer, and focus
// reports only while the program asked for them, at once when it does and
// then on every change.
class TermRepliesTest {
  private fun ByteArray?.text() = this?.toString(Charsets.US_ASCII)

  @Test fun answersTheStatusQueryAsItEnded() {
    val r = TermReplies()
    assertEquals("\u001b]7501;?\u0007", r.onSignal(Signal.StatusQuery(bel = true)).text())
    assertEquals("\u001b]7501;?\u001b\\", r.onSignal(Signal.StatusQuery(bel = false)).text())
    assertNull(r.onSignal(Signal.Status("state=idle")))
    assertNull(r.onSignal(Signal.Bell))
  }

  @Test fun noFocusReportsUntilTheProgramAsks() {
    val r = TermReplies()
    assertNull(r.focus(true))
    assertNull(r.focus(false))
    assertNull(r.onSignal(Signal.Modes(listOf(25, 2004), true)))
    assertFalse(r.focusReports)
  }

  @Test fun turningReportsOnTellsTheFocusAtOnce() {
    val r = TermReplies()
    assertEquals("\u001b[O", r.onSignal(Signal.Modes(listOf(1004), true)).text())
    assertTrue(r.focusReports)
    assertEquals("\u001b[I", r.focus(true).text())
    assertNull(r.focus(true), "no change, no report")
    // Set again (a redraw, a new screen): told again.
    assertEquals("\u001b[I", r.onSignal(Signal.Modes(listOf(2004, 1004), true)).text())
    assertEquals("\u001b[O", r.focus(false).text())
  }

  @Test fun resetOrModeOffStopsReports() {
    val r = TermReplies()
    r.onSignal(Signal.Modes(listOf(1004), true))
    assertNull(r.onSignal(Signal.Modes(listOf(1004), false)))
    assertNull(r.focus(true))
    assertEquals("\u001b[I", r.onSignal(Signal.Modes(listOf(1004), true)).text())
    assertNull(r.onSignal(Signal.Reset))
    assertFalse(r.focusReports)
    assertNull(r.focus(false))
    // The focus moved meanwhile: the next request hears the latest.
    assertEquals("\u001b[O", r.onSignal(Signal.Modes(listOf(1004), true)).text())
  }
}
