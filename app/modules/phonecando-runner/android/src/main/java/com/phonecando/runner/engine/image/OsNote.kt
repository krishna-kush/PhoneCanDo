package com.phonecando.runner.engine.image

import java.io.File

// The image's OS note (run/os-note.md: OS, package manager, no systemd) at
// the end of the agent's instructions file, between two marker lines. Each
// start replaces the block, so it is there once however often the engine
// starts and whether or not the seeder rewrote the file first; an image
// without a note gets the block removed. Pure JVM.
object OsNote {
  const val BEGIN = "<!-- phonecando:os-note -->"
  const val END = "<!-- /phonecando:os-note -->"

  /** Writes `instructions` only when its text changes. */
  fun apply(instructions: File, note: File) {
    val noteText = try {
      if (note.isFile) note.readText(Charsets.UTF_8) else null
    } catch (_: Exception) {
      null
    }
    val current = if (instructions.isFile) instructions.readText(Charsets.UTF_8) else null
    val next = merge(current, noteText)
    if (next == (current ?: "")) return
    instructions.parentFile?.mkdirs()
    instructions.writeText(next, Charsets.UTF_8)
  }

  /** `instructions` without any old block, then the note's block when there is a note. */
  fun merge(instructions: String?, note: String?): String {
    val base = strip(instructions ?: "")
    val body = note?.trim()?.takeIf { it.isNotEmpty() } ?: return base
    val sep = when {
      base.isEmpty() -> ""
      base.endsWith("\n\n") -> ""
      base.endsWith("\n") -> "\n"
      else -> "\n\n"
    }
    return "$base$sep$BEGIN\n$body\n$END\n"
  }

  // Drops the block and the blank line put before it.
  private fun strip(text: String): String {
    val start = text.indexOf(BEGIN)
    if (start < 0) return text
    val endAt = text.indexOf(END, start)
    val after = if (endAt < 0) text.length else (endAt + END.length).let { if (text.startsWith("\n", it)) it + 1 else it }
    val before = text.substring(0, start).trimEnd('\n')
    val rest = text.substring(after)
    return when {
      before.isEmpty() -> rest
      rest.isEmpty() -> "$before\n"
      else -> "$before\n\n$rest"
    }
  }
}
