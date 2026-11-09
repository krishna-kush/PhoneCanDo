package com.phonecando.agents.kit.term

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// JVM checks for SignalScanner: each signal it reads, the sequences it must
// not mistake for one, and the same signals however the stream is split.
class SignalScannerTest {
  private fun scan(vararg chunks: String): List<Signal> {
    val scanner = SignalScanner()
    val out = ArrayList<Signal>()
    for (c in chunks) scanner.feed(c.toByteArray(Charsets.UTF_8)) { out += it }
    return out
  }

  // Every way to cut [text] in two gives the same signals as the whole.
  private fun assertSplitSafe(text: String, expected: List<Signal>) {
    assertEquals(expected, scan(text), "whole")
    val bytes = text.toByteArray(Charsets.UTF_8)
    for (cut in 1 until bytes.size) {
      val scanner = SignalScanner()
      val out = ArrayList<Signal>()
      scanner.feed(bytes, 0, cut) { out += it }
      scanner.feed(bytes, cut, bytes.size - cut) { out += it }
      assertEquals(expected, out, "cut at $cut")
    }
  }

  @Test fun readsEachSignal() {
    assertEquals(listOf(Signal.Bell), scan("a\u0007b"))
    assertEquals(listOf(Signal.Title("Fix login")), scan("\u001b]0;Fix login\u0007"))
    assertEquals(listOf(Signal.Title("x")), scan("\u001b]2;x\u001b\\"))
    assertEquals(listOf(Signal.Osc9("Approval requested")), scan("\u001b]9;Approval requested\u0007"))
    assertEquals(listOf(Signal.Progress("1;50")), scan("\u001b]9;4;1;50\u0007"))
    assertEquals(listOf(Signal.Osc777("Done;all tests pass")), scan("\u001b]777;notify;Done;all tests pass\u0007"))
    assertEquals(listOf(Signal.FullClear), scan("\u001b[H\u001b[2J"))
    assertEquals(listOf(Signal.Reset), scan("\u001bc"))
    assertEquals(
      listOf(Signal.AltScreen(true), Signal.Modes(listOf(1049, 25), true)),
      scan("\u001b[?1049;25h"),
    )
    assertEquals(listOf(Signal.Modes(listOf(2004), false)), scan("\u001b[?2004l"))
  }

  @Test fun ignoresWhatIsNoSignal() {
    // A BEL that ends an OSC, one inside a DCS, titles we don't read, other erases and modes.
    assertEquals(emptyList(), scan("\u001b]1;icon\u0007\u001bP1;2|x\u0007y\u001b\\"))
    assertEquals(emptyList(), scan("\u001b[J\u001b[3J\u001b[?2J\u001b[4h\u001b]777;preexec\u0007\u001b]104\u0007"))
    // 8-bit C1 codes are UTF-8 text: U+075D is D D9 9D.
    assertEquals(emptyList(), scan("ݝ\u009d"))
    // A charset designation's final byte is not text and starts nothing.
    assertEquals(listOf(Signal.Bell), scan("\u001b(B\u0007"))
  }

  @Test fun anOscOverTheCapSaysNothing() {
    assertEquals(emptyList(), scan("\u001b]0;" + "x".repeat(5000) + "\u0007"))
    assertEquals(listOf(Signal.Bell), scan("\u001b]0;" + "x".repeat(5000) + "\u0007\u0007"))
  }

  @Test fun anEscEndsAnOscAndStartsTheNextSequence() {
    assertEquals(listOf(Signal.Title("t"), Signal.Reset), scan("\u001b]0;t\u001bc"))
  }

  @Test fun sequencesSplitAnywhere() {
    assertSplitSafe(
      "é\u001b]0;Tîtle\u001b\\x\u0007\u001b[?1049h\u001b]9;4;3\u0007\u001b[2J\u001b]777;notify;a;b\u0007",
      listOf(
        Signal.Title("Tîtle"),
        Signal.Bell,
        Signal.AltScreen(true),
        Signal.Modes(listOf(1049), true),
        Signal.Progress("3"),
        Signal.FullClear,
        Signal.Osc777("a;b"),
      ),
    )
  }

  @Test fun boundariesAndPositions() {
    val s = SignalScanner()
    assertTrue(s.atBoundary)
    s.feed("é".toByteArray(), 0, 1) {}
    assertFalse(s.atBoundary, "mid character")
    s.feed("é".toByteArray(), 1, 1) {}
    assertTrue(s.atBoundary)
    var start = -1L
    s.feed("ab\u001b[2".toByteArray()) {}
    assertFalse(s.atBoundary, "mid sequence")
    s.feed("J".toByteArray()) { start = s.sequenceStart }
    assertEquals(4L, start)
    assertEquals(8L, s.position)
    assertTrue(s.atBoundary)
  }
}
