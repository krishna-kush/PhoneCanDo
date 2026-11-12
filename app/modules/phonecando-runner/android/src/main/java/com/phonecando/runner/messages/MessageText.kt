package com.phonecando.runner.messages

// What is left of an agent's text before anyone else sees it: line breaks
// become \n, and every control character but \n and \t goes (C0, DEL, C1),
// as does every format character (Unicode Cf: the bidi controls and
// isolates, zero-width spaces and joiners, the BOM, the invisible tag
// characters), so text cannot hide what it says or reorder what a reader
// sees. U+2028 and U+2029 read as \n. Whitespace around it goes; nothing
// is cut, a sender over the cap is refused (MessageRules.MAX_CHARS).
// Pure.
object MessageText {
  fun clean(raw: String): String {
    val text = raw.replace("\r\n", "\n").replace('\r', '\n')
    val out = StringBuilder(text.length)
    var i = 0
    while (i < text.length) {
      val cp = text.codePointAt(i)
      i += Character.charCount(cp)
      when {
        cp == '\n'.code || cp == '\t'.code -> out.append(cp.toChar())
        cp == LINE_SEPARATOR || cp == PARAGRAPH_SEPARATOR -> out.append('\n')
        Character.getType(cp) == Character.CONTROL.toInt() -> {}
        Character.getType(cp) == Character.FORMAT.toInt() -> {}
        else -> out.appendCodePoint(cp)
      }
    }
    return out.toString().trim()
  }

  /** A name or label for an attribute: one line, cleaned, at most [max] characters. */
  fun oneLine(raw: String, max: Int = 80): String =
    clean(raw).replace('\n', ' ').replace('\t', ' ').trim().take(max)

  private const val LINE_SEPARATOR = 0x2028
  private const val PARAGRAPH_SEPARATOR = 0x2029
}
