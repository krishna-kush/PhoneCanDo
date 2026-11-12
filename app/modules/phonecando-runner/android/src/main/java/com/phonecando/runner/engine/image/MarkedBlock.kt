package com.phonecando.runner.engine.image

import java.io.File

// One block of ours in a text file an agent reads (its instructions file),
// between a begin and an end marker line. merge() puts the body where the
// old block was, or at the end when there is none, and removes the block
// and the blank line put before it when there is no body; the text around
// it stays as it is. So a block is there once however often it is
// written, whether or not the seeder rewrote the file in between, and two
// blocks in one file (OsNote, MachineNote) keep their places. Pure JVM.
class MarkedBlock(private val begin: String, private val end: String) {
  /** Writes [file] only when its text changes; with no body, a missing file stays missing. */
  fun apply(file: File, body: String?) {
    val current = if (file.isFile) file.readText(Charsets.UTF_8) else null
    val next = merge(current, body)
    if (next == (current ?: "")) return
    file.parentFile?.mkdirs()
    file.writeText(next, Charsets.UTF_8)
  }

  /** [text] with the block holding [body] (trimmed), or without the block when [body] is null or blank. */
  fun merge(text: String?, body: String?): String {
    val base = text ?: ""
    val block = body?.trim()?.takeIf { it.isNotEmpty() }?.let { "$begin\n$it\n$end\n" }
    val start = base.indexOf(begin)
    if (start < 0) return if (block == null) base else append(base, block)
    val endAt = base.indexOf(end, start)
    val stop = if (endAt < 0) base.length else (endAt + end.length).let { if (base.startsWith("\n", it)) it + 1 else it }
    val rest = base.substring(stop)
    if (block != null) return base.substring(0, start) + block + rest
    // Removed: one blank line where the block was, none at either end.
    val before = base.substring(0, start).trimEnd('\n')
    val after = rest.trimStart('\n')
    return when {
      before.isEmpty() -> after
      after.isEmpty() -> "$before\n"
      else -> "$before\n\n$after"
    }
  }

  // A blank line between the text and a new block.
  private fun append(base: String, block: String): String {
    val sep = when {
      base.isEmpty() -> ""
      base.endsWith("\n\n") -> ""
      base.endsWith("\n") -> "\n"
      else -> "\n\n"
    }
    return "$base$sep$block"
  }
}
