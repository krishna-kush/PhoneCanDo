package com.phonecando.agents.kit.term

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// JVM checks for ScreenRing: where it trims, that a cut never lands inside
// a sequence or a character, and the state prologue in front of a replay.
class ScreenRingTest {
  private val ris = "\u001bc"

  private fun ScreenRing.add(text: String) = append(text.toByteArray(Charsets.UTF_8))

  private fun ScreenRing.replayText() = replay().toString(Charsets.UTF_8)

  @Test fun keepsEverythingUntilAClear() {
    val ring = ScreenRing()
    ring.add("one\r\n")
    ring.add("two")
    assertEquals("${ris}one\r\ntwo", ring.replayText())
    ring.add("\u001b[H\u001b[2Jthree")
    assertEquals("${ris}\u001b[2Jthree", ring.replayText())
    assertEquals(11L, ring.dropped)
  }

  @Test fun trimsAtTheLastAltScreenEntryWithTheModesBeforeIt() {
    val ring = ScreenRing()
    ring.add("shell$ \u001b[?2004h\u001b[?25l")
    ring.add("\u001b[?1049h")
    ring.add("\u001b[?1hmenu")
    // Before the entry: cursor hidden and bracketed paste on; the entry and DECCKM replay themselves.
    assertEquals("$ris\u001b[?25l\u001b[?2004h\u001b[?1049h\u001b[?1hmenu", ring.replayText())
    ring.add("\u001b[2Jframe")
    // Cut at the clear: now every mode is the prologue's, the alternate screen first.
    assertEquals("$ris\u001b[?1049h\u001b[?25l\u001b[?1h\u001b[?2004h\u001b[2Jframe", ring.replayText())
    ring.add("\u001b[?1049l\u001b[?25h")
    assertEquals(
      "$ris\u001b[?1049h\u001b[?25l\u001b[?1h\u001b[?2004h\u001b[2Jframe\u001b[?1049l\u001b[?25h",
      ring.replayText(),
    )
  }

  @Test fun theTitleBeforeTheCutIsInThePrologue() {
    val ring = ScreenRing()
    ring.add("\u001b]0;Fix login\u0007old\u001b[2Jnew")
    assertEquals("$ris\u001b]2;Fix login\u0007\u001b[2Jnew", ring.replayText())
    ring.add("\u001bc")
    // A reset keeps the window title.
    assertEquals("$ris\u001b]2;Fix login\u0007\u001bc", ring.replayText())
  }

  @Test fun aResetStartsOver() {
    val ring = ScreenRing()
    ring.add("\u001b[?1049h\u001b[?25lold\u001bcnew")
    assertEquals("$ris\u001b[?1049h\u001b[?25l\u001bcnew", ring.replayText())
    ring.add("\u001b[2J")
    assertEquals("$ris\u001b[2J", ring.replayText())
  }

  @Test fun aClearSplitAcrossAppendsStillCuts() {
    val ring = ScreenRing()
    ring.add("abc\u001b[")
    ring.add("2Jd")
    assertEquals("$ris\u001b[2Jd", ring.replayText())
  }

  @Test fun trimsForRoomOnlyBetweenSequencesAndCharacters() {
    val ring = ScreenRing(capacity = 64, chunkBytes = 16)
    val title = "\u001b]0;" + "t".repeat(20) + "\u0007"
    repeat(20) { ring.add("é$title\u001b[?1h") }
    val replay = ring.replayText()
    assertTrue(ring.size <= 64 + 16 + title.length, "size ${ring.size}")
    assertTrue(ring.dropped > 0)
    // DECCKM and the title, set before the cut, are in the prologue; the kept bytes start with one whole unit.
    val kept = replay.removePrefix("$ris\u001b[?1h\u001b]2;${"t".repeat(20)}\u0007")
    assertTrue(kept.length < replay.length, replay)
    assertTrue(listOf("é", "\u001b]0;", "\u001b[?1h").any(kept::startsWith), kept)
    assertFalse('\uFFFD' in replay)
  }

  @Test fun oneSequenceLongerThanTheRingIsDroppedWhole() {
    val ring = ScreenRing(capacity = 64, chunkBytes = 16)
    ring.add("before")
    ring.add("\u001bP" + "q".repeat(200))
    assertEquals(0, ring.size)
    ring.add("q\u001b\\after")
    assertEquals("${ris}after", ring.replayText())
  }

  @Test fun signalsPassThroughInOrder() {
    val ring = ScreenRing()
    val seen = ArrayList<Signal>()
    ring.append("\u0007\u001b]0;t\u0007\u001b[2J".toByteArray()) { seen += it }
    assertEquals(listOf(Signal.Bell, Signal.Title("t"), Signal.FullClear), seen)
  }

  @Test fun tail() {
    val ring = ScreenRing()
    ring.add("hello world")
    assertEquals("world" to true, ring.tail(5).let { it.first.toString(Charsets.UTF_8) to it.second })
    assertEquals("hello world" to false, ring.tail(100).let { it.first.toString(Charsets.UTF_8) to it.second })
  }
}
