package com.phonecando.runner.checks.rules

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// A TUI's output as text: escape sequences and control bytes out, lines
// kept; the needle S5 looks for; the last lines a quit quotes.
class ScreenTextTest {
  private val esc = "\u001b"

  @Test fun escapeSequencesAndControlBytesGo() {
    val raw = "$esc[2J$esc[1;1H$esc[38;5;196mred$esc[0m text$esc]0;title\u0007 and$esc]8;;https://x$esc\\link$esc]8;;$esc\\" +
      "$esc(B$esc=done\u0008\u0000\u007f"
    assertEquals("red text andlinkdone", ScreenText.strip(raw))
    // 8-bit forms, and a DCS string.
    assertEquals("ab", ScreenText.strip("\u009b31ma\u009d0;t\u0007${esc}Pq#0\u001b\\b"))
  }

  @Test fun linesStayAndTabsBecomeSpaces() {
    assertEquals("one\n\ntwo three\n", ScreenText.strip("one\r\ntwo\tthree\n"))
  }

  @Test fun bytesDecodeAsUtf8AndACutSequenceEnds() {
    assertEquals("✓ ok", ScreenText.strip("✓ ok".toByteArray()))
    assertEquals("x", ScreenText.strip("x$esc[38;5"))
    assertEquals("x", ScreenText.strip("x$esc]0;never ends"))
    assertEquals("x", ScreenText.strip("x$esc"))
  }

  @Test fun compactDropsAllWhitespace() {
    assertEquals("Scheduledtask", ScreenText.compact(" Sched\nuled\t task "))
  }

  @Test fun theNeedleIsAMarkerElseTheFirst32Characters() {
    assertEquals("Scheduledtaskfromtheuser", ScreenText.needle("Scheduled task from the user (every 30 min): tidy up"))
    assertEquals("PhoneCanDocheck:", ScreenText.needle("PhoneCanDo check: reply with just the word done."))
    val plain = ScreenText.needle("  Fix the failing tests in the parser module, then commit.")!!
    assertEquals(ScreenText.NEEDLE_CHARS, plain.length)
    assertTrue(plain.startsWith("Fixthefailingtests"))
    assertEquals("short", ScreenText.needle("short"))
    assertNull(ScreenText.needle(" \n\t "))
  }

  @Test fun theLastThreeNonEmptyLinesAtMost200Characters() {
    assertEquals("b\nc\nd", ScreenText.lastLines("a\n  b  \n\n c\n\nd\n\n"))
    assertNull(ScreenText.lastLines("\n \n"))
    val long = ScreenText.lastLines("x".repeat(500))!!
    assertEquals(200, long.length)
    assertTrue(long.startsWith("…"))
  }
}
