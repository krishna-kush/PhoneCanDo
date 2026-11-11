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

  @Test fun programStatusReportsAndTheQuery() {
    assertEquals(listOf(Signal.Status("state=blocked:kind=auth")), scan("\u001b]7501;kind=auth:state=blocked\u001b\\"))
    assertEquals(listOf(Signal.Status("state=idle")), scan("\u001b]7501;state=idle\u0007"))
    assertEquals(listOf(Signal.StatusQuery(bel = false)), scan("\u001b]7501;?\u001b\\"))
    assertEquals(listOf(Signal.StatusQuery(bel = true)), scan("\u001b]7501;?\u0007"))
    // Reports the spec drops say nothing; so does a query with more in it.
    assertEquals(emptyList(), scan("\u001b]7501;state=paused\u0007\u001b]7501;app=x\u0007\u001b]7501;?x\u0007\u001b]7501\u0007"))
    // The whole sequence, ESC ] through ST, is at most 4096 bytes.
    val fits = "state=done:x=" + "a".repeat(4096 - 9 - 13)
    assertEquals(listOf(Signal.Status("state=done")), scan("\u001b]7501;$fits\u001b\\"))
    assertEquals(emptyList(), scan("\u001b]7501;${fits}a\u001b\\"))
    assertEquals(listOf(Signal.Status("state=done")), scan("\u001b]7501;${fits}a\u0007"))
  }

  @Test fun anEscEndsAnOscAndStartsTheNextSequence() {
    assertEquals(listOf(Signal.Title("t"), Signal.Reset), scan("\u001b]0;t\u001bc"))
  }

  @Test fun sequencesSplitAnywhere() {
    assertSplitSafe(
      "é\u001b]0;Tîtle\u001b\\x\u0007\u001b[?1049h\u001b]9;4;3\u0007\u001b[2J\u001b]777;notify;a;b\u0007" +
        "\u001b]7501;?\u001b\\\u001b]7501;state=working\u0007",
      listOf(
        Signal.Title("Tîtle"),
        Signal.Bell,
        Signal.AltScreen(true),
        Signal.Modes(listOf(1049), true),
        Signal.Progress("3"),
        Signal.FullClear,
        Signal.Osc777("a;b"),
        Signal.StatusQuery(bel = false),
        Signal.Status("state=working"),
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

  @Test fun colourQueries() {
    assertEquals(listOf(Signal.ColorQuery(11, null, bel = false)), scan("\u001b]11;?\u001b\\"))
    assertEquals(listOf(Signal.ColorQuery(11, null, bel = true)), scan("\u001b]11;?\u0007"))
    // One OSC 10 asks for 10 and 11; a field that sets a colour asks nothing.
    assertEquals(
      listOf(Signal.ColorQuery(10, null, true), Signal.ColorQuery(11, null, true)),
      scan("\u001b]10;?;?\u0007"),
    )
    assertEquals(listOf(Signal.ColorQuery(12, null, true)), scan("\u001b]10;#ffffff;rgb:0/0/0;?\u0007"))
    assertEquals(listOf(Signal.ColorQuery(12, null, true)), scan("\u001b]12;?\u0007"))
    assertEquals(
      listOf(Signal.ColorQuery(4, 1, false), Signal.ColorQuery(4, 200, false)),
      scan("\u001b]4;1;?;2;#00ff00;200;?\u001b\\"),
    )
    // Past 12 (pointer and highlight colours), and plain sets: none.
    assertEquals(emptyList(), scan("\u001b]11;#000000\u0007\u001b]17;?\u0007\u001b]4;x;?\u0007"))
    assertSplitSafe("a\u001b]11;?\u001b\\b", listOf(Signal.ColorQuery(11, null, false)))
  }

  @Test fun themeDeviceAndStatusQueries() {
    assertEquals(listOf(Signal.ThemeQuery), scan("\u001b[?996n"))
    assertEquals(listOf(Signal.DeviceAttributesQuery, Signal.DeviceAttributesQuery), scan("\u001b[c\u001b[0c"))
    assertEquals(listOf(Signal.OperatingStatusQuery), scan("\u001b[5n"))
    // Secondary and tertiary attributes, the cursor report and other DSRs are not these.
    assertEquals(emptyList(), scan("\u001b[>c\u001b[>0c\u001b[=c\u001b[6n\u001b[?6n\u001b[996n\u001b[?5n"))
    assertEquals(listOf(Signal.Modes(listOf(2031), true)), scan("\u001b[?2031h"))
  }
}
