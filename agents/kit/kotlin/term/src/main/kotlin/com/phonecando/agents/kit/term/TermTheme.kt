package com.phonecando.agents.kit.term

// The colours a terminal shows and whether they read as dark or light, and
// how a terminal tells a program about them: the answer to an OSC 4 / 10 /
// 11 / 12 colour query (`rgb:rrrr/gggg/bbbb`, as xterm words it, ending as
// the query did), the theme report of DEC private mode 2031 and its query
// (`CSI ? 997 ; 1 n` dark, `; 2 n` light: contour's colour palette update
// notifications) and COLORFGBG (`15;0` white on black, `0;15` black on
// white), which a program reads at start.
// Palette entries 16-255 are xterm's standard cube and grey ramp, as
// xterm.js draws them. Pure.
data class TermTheme(
  val dark: Boolean,
  val foreground: Rgb,
  val background: Rgb,
  val cursor: Rgb,
  /** The 16 ANSI colours, black to bright white. */
  val ansi: List<Rgb>,
) {
  init {
    require(ansi.size == ANSI_COUNT) { "a theme has $ANSI_COUNT ANSI colours, not ${ansi.size}" }
  }

  data class Rgb(val r: Int, val g: Int, val b: Int) {
    /** xterm's spelling: each 8-bit channel repeated to 16 bits. */
    val spec: String get() = "rgb:${hex(r)}/${hex(g)}/${hex(b)}"

    private fun hex(c: Int) = "%02x".format(c).repeat(2)

    companion object {
      private val HEX = Regex("#([0-9a-fA-F]{6})")

      /** `#rrggbb`, or null for anything else. */
      fun parse(text: String): Rgb? {
        val m = HEX.matchEntire(text.trim()) ?: return null
        val n = m.groupValues[1].toInt(16)
        return Rgb((n shr 16) and 0xff, (n shr 8) and 0xff, n and 0xff)
      }
    }
  }

  /** The COLORFGBG value a program starts with. */
  val colorFgBg: String get() = if (dark) "15;0" else "0;15"

  /** Palette entry [index] (0-255), or null past it. */
  fun palette(index: Int): Rgb? = when (index) {
    in 0 until ANSI_COUNT -> ansi[index]
    in 16..231 -> (index - 16).let { Rgb(CUBE[it / 36], CUBE[it / 6 % 6], CUBE[it % 6]) }
    in 232..255 -> (8 + (index - 232) * 10).let { Rgb(it, it, it) }
    else -> null
  }

  /** The answer to [query], or null when it names no colour this theme has. */
  fun answer(query: Signal.ColorQuery): ByteArray? {
    val color = when (query.osc) {
      OSC_PALETTE -> query.index?.let(::palette)
      OSC_FOREGROUND -> foreground
      OSC_BACKGROUND -> background
      OSC_CURSOR -> cursor
      else -> null
    } ?: return null
    val ident = if (query.osc == OSC_PALETTE) "$OSC_PALETTE;${query.index}" else "${query.osc}"
    val end = if (query.bel) "\u0007" else "\u001b\\"
    return "\u001b]$ident;${color.spec}$end".toByteArray(Charsets.US_ASCII)
  }

  /** The theme report: what `CSI ? 996 n` gets, and what mode 2031 sends on a change. */
  fun report(): ByteArray = "\u001b[?997;${if (dark) 1 else 2}n".toByteArray(Charsets.US_ASCII)

  companion object {
    const val ANSI_COUNT = 16
    const val OSC_PALETTE = 4
    const val OSC_FOREGROUND = 10
    const val OSC_BACKGROUND = 11
    const val OSC_CURSOR = 12

    private val CUBE = intArrayOf(0, 95, 135, 175, 215, 255)

    /** From `#rrggbb` strings (the app's palette); null when one is not that. */
    fun of(dark: Boolean, foreground: String, background: String, cursor: String, ansi: List<String>): TermTheme? {
      val colors = ansi.map { Rgb.parse(it) ?: return null }
      if (colors.size != ANSI_COUNT) return null
      return TermTheme(
        dark,
        Rgb.parse(foreground) ?: return null,
        Rgb.parse(background) ?: return null,
        Rgb.parse(cursor) ?: return null,
        colors,
      )
    }
  }
}
