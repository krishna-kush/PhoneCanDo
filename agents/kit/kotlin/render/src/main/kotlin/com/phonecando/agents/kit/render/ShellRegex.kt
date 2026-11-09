package com.phonecando.agents.kit.render

// A runtime's check pattern (Java/JS syntax) as a POSIX ERE, for the guest's
// grep -E and sed -E: the install script tests a runtime with them before
// installing it. \d \s \w become bracket classes, an escaped symbol stays
// escaped only where ERE gives it a meaning, and everything ERE cannot say
// the same way is refused: (?…) groups, lazy and possessive quantifiers,
// nested brackets and any other escape. The kit's TS validator keeps
// runtime.json to this subset (ereProblem in runtime-plugin.ts).
internal object ShellRegex {
  private const val ERE_SPECIAL = ".[]()*+?{}|^$\\"

  /** [pattern] as an ERE; throws IllegalArgumentException for what has none. */
  fun ere(pattern: String): String {
    val out = StringBuilder()
    var bracket = -1 // where the open bracket's items start, or -1
    var i = 0
    fun refuse(why: String): Nothing = throw IllegalArgumentException("the pattern $pattern has no POSIX ERE form: $why")
    while (i < pattern.length) {
      val c = pattern[i]
      when {
        c == '\\' -> {
          val next = pattern.getOrNull(i + 1) ?: refuse("it ends in a lone backslash")
          out.append(escape(next, inBracket = bracket >= 0) ?: refuse("\\$next"))
          i += 2
        }
        bracket >= 0 -> {
          if (c == '[') refuse("a [ inside a bracket expression")
          if (c == ']' && i > bracket) bracket = -1
          out.append(c)
          i += 1
        }
        c == '[' -> {
          bracket = if (pattern.getOrNull(i + 1) == '^') i + 2 else i + 1
          out.append(pattern, i, bracket)
          i = bracket
        }
        c == '(' && pattern.getOrNull(i + 1) == '?' -> refuse("a (?…) group")
        c in "*+?}" && pattern.getOrNull(i + 1).let { it == '?' || it == '+' } -> refuse("a lazy or possessive quantifier")
        else -> {
          out.append(c)
          i += 1
        }
      }
    }
    if (bracket >= 0) refuse("a bracket expression is not closed")
    return out.toString()
  }

  /**
   * A sed -nE command that prints group 1 of [ere] when [ere] matches its
   * whole input line (grep -oE hands it just the match): the pattern's own
   * anchors dropped, the rest grouped and anchored, so its group 1 is \2.
   */
  fun groupOne(ere: String): String {
    val start = if (ere.startsWith("^")) 1 else 0
    val end = if (ere.endsWith("$") && !ere.endsWith("\\$")) ere.length - 1 else ere.length
    val whole = "^(" + ere.substring(start, end.coerceAtLeast(start)) + ")$"
    val delimiter = SED_DELIMITERS.firstOrNull { it !in whole }
      ?: throw IllegalArgumentException("the pattern $ere leaves sed no delimiter")
    return "s$delimiter$whole$delimiter\\2${delimiter}p"
  }

  private const val SED_DELIMITERS = "#%,@!~:;"

  private fun escape(c: Char, inBracket: Boolean): String? = when {
    c == 'd' -> if (inBracket) "0-9" else "[0-9]"
    c == 's' -> if (inBracket) "[:space:]" else "[[:space:]]"
    c == 'w' -> if (inBracket) "[:alnum:]_" else "[[:alnum:]_]"
    inBracket -> if (c == '.') "." else null
    c.isLetterOrDigit() -> null
    c in ERE_SPECIAL -> "\\$c"
    else -> c.toString()
  }
}
