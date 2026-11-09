package com.phonecando.agents.kit.render

// One word for a POSIX shell: single-quoted, each ' written as '\''. The
// shell reads it back exactly, with no expansion.
internal object ShellQuote {
  fun word(text: String): String = "'" + text.replace("'", "'\\''") + "'"

  fun words(items: List<String>): String = items.joinToString(" ", transform = ::word)
}
