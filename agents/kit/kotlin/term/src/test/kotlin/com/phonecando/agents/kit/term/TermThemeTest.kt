package com.phonecando.agents.kit.term

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

// JVM checks for TermTheme: parsing the app's colours, the 256-entry
// palette, the answers to colour queries in xterm's words and the theme
// report, and COLORFGBG.
class TermThemeTest {
  companion object {
    private val ANSI = (0 until 16).map { "#%02x%02x%02x".format(it, it * 2, it * 3) }

    fun theme(dark: Boolean): TermTheme = checkNotNull(
      if (dark) {
        TermTheme.of(true, "#e6e6e6", "#0a0a0a", "#00ff00", ANSI)
      } else {
        TermTheme.of(false, "#1a1a1a", "#ffffff", "#1a7f37", ANSI)
      },
    )
  }

  private fun ByteArray?.text() = this?.toString(Charsets.US_ASCII)

  @Test fun parsesHexOnly() {
    assertEquals(TermTheme.Rgb(10, 255, 0), TermTheme.Rgb.parse("#0aFF00"))
    assertNull(TermTheme.Rgb.parse("0aff00"))
    assertNull(TermTheme.Rgb.parse("#0af"))
    assertNull(TermTheme.Rgb.parse("rgba(0, 0, 0, 0.2)"))
    assertNull(TermTheme.of(true, "#e6e6e6", "#0a0a0a", "#00ff00", ANSI.dropLast(1)))
    assertNull(TermTheme.of(true, "#e6e6e6", "black", "#00ff00", ANSI))
  }

  @Test fun paletteIsTheAnsiColoursThenXtermsCubeAndGreys() {
    val t = theme(dark = true)
    assertEquals(TermTheme.Rgb(1, 2, 3), t.palette(1))
    assertEquals(TermTheme.Rgb(0, 0, 0), t.palette(16))
    assertEquals(TermTheme.Rgb(255, 255, 255), t.palette(231))
    assertEquals(TermTheme.Rgb(95, 135, 175), t.palette(16 + 36 + 2 * 6 + 3))
    assertEquals(TermTheme.Rgb(8, 8, 8), t.palette(232))
    assertEquals(TermTheme.Rgb(238, 238, 238), t.palette(255))
    assertNull(t.palette(256))
    assertNull(t.palette(-1))
  }

  @Test fun answersInXtermsWordsEndingAsTheQueryDid() {
    val t = theme(dark = true)
    assertEquals("\u001b]10;rgb:e6e6/e6e6/e6e6\u001b\\", t.answer(Signal.ColorQuery(10, null, false)).text())
    assertEquals("\u001b]11;rgb:0a0a/0a0a/0a0a\u0007", t.answer(Signal.ColorQuery(11, null, true)).text())
    assertEquals("\u001b]12;rgb:0000/ffff/0000\u0007", t.answer(Signal.ColorQuery(12, null, true)).text())
    assertEquals("\u001b]4;3;rgb:0303/0606/0909\u001b\\", t.answer(Signal.ColorQuery(4, 3, false)).text())
    assertNull(t.answer(Signal.ColorQuery(4, 300, false)))
    assertNull(t.answer(Signal.ColorQuery(17, null, false)))
  }

  @Test fun reportAndColorFgBg() {
    assertEquals("\u001b[?997;1n", theme(dark = true).report().text())
    assertEquals("\u001b[?997;2n", theme(dark = false).report().text())
    assertEquals("15;0", theme(dark = true).colorFgBg)
    assertEquals("0;15", theme(dark = false).colorFgBg)
  }
}
