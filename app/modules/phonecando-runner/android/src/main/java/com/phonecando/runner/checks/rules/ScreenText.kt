package com.phonecando.runner.checks.rules

// A TUI's output as plain text, for S5 (its task on screen) and the last
// lines a quit_error quotes. strip() decodes the bytes as UTF-8 and drops
// escape sequences (CSI, OSC, DCS and the other strings, charset picks,
// two-character ones, and their 8-bit forms) and every other control
// character, keeping line breaks (a carriage return is one too) and tabs as
// spaces. A tail that starts inside a sequence shows its rest as text.
// compact() drops all whitespace, so a line the TUI wrapped still matches.
// Pure.
internal object ScreenText {
  private const val ESC = '\u001b'
  private const val BEL = '\u0007'
  private const val C1_CSI = '\u009b'
  private const val C1_ST = '\u009c'
  private const val C1_OSC = '\u009d'

  /** The prompt parts we put first in a task, which S5 looks for when the prompt has one. */
  private val MARKERS = listOf("Scheduled task from the user", "PhoneCanDo check:")

  /** Without one, the prompt's first this many non-whitespace characters. */
  const val NEEDLE_CHARS = 32

  fun strip(bytes: ByteArray): String = strip(String(bytes, Charsets.UTF_8))

  fun strip(text: String): String {
    val out = StringBuilder(text.length)
    var i = 0
    val n = text.length
    while (i < n) {
      val c = text[i]
      when {
        c == ESC -> i = afterEscape(text, i + 1)
        c == C1_CSI -> i = afterCsi(text, i + 1)
        c == C1_OSC || c == '\u0090' || c == '\u0098' || c == '\u009e' || c == '\u009f' -> i = afterString(text, i + 1)
        else -> {
          when {
            c == '\n' || c == '\r' -> out.append('\n')
            c == '\t' -> out.append(' ')
            c < ' ' || c == '\u007f' || c in '\u0080'..'\u009f' -> {}
            else -> out.append(c)
          }
          i++
        }
      }
    }
    return out.toString()
  }

  fun compact(text: String): String = text.filterNot { it.isWhitespace() }

  /** What S5 looks for, compacted: a marker the prompt holds, else its first NEEDLE_CHARS; null for a blank prompt. */
  fun needle(prompt: String): String? {
    val flat = compact(prompt)
    MARKERS.map(::compact).firstOrNull { it in flat }?.let { return it }
    return flat.take(NEEDLE_CHARS).ifEmpty { null }
  }

  /** The last [count] non-empty lines of [text] (stripped), trimmed, one per line, at most [max] characters (the end kept); null for none. */
  fun lastLines(text: String, count: Int = 3, max: Int = CheckCopy.QUOTE_MAX): String? {
    val lines = text.lineSequence().map { it.trim() }.filter { it.isNotEmpty() }.toList().takeLast(count)
    if (lines.isEmpty()) return null
    val joined = lines.joinToString("\n")
    return if (joined.length <= max) joined else "…" + joined.takeLast(max - 1)
  }

  // [i] is just past ESC.
  private fun afterEscape(text: String, i: Int): Int {
    if (i >= text.length) return i
    return when (text[i]) {
      '[' -> afterCsi(text, i + 1)
      ']', 'P', 'X', '^', '_' -> afterString(text, i + 1)
      in ' '..'/' -> {
        // Intermediates (a charset pick: ESC ( B), then one final character.
        var j = i
        while (j < text.length && text[j] in ' '..'/') j++
        minOf(j + 1, text.length)
      }
      else -> i + 1
    }
  }

  // Parameters and intermediates up to a final character, @ to ~.
  private fun afterCsi(text: String, i: Int): Int {
    var j = i
    while (j < text.length && text[j] !in '@'..'~') j++
    return minOf(j + 1, text.length)
  }

  // A string up to BEL, ESC \ or ST.
  private fun afterString(text: String, i: Int): Int {
    var j = i
    while (j < text.length) {
      when {
        text[j] == BEL || text[j] == C1_ST -> return j + 1
        text[j] == ESC && j + 1 < text.length && text[j + 1] == '\\' -> return j + 2
      }
      j++
    }
    return j
  }
}
