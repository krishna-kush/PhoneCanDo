package com.phonecando.runner.engine.image

import java.io.File

// The image's OS note (run/os-note.md: OS, package manager, no systemd) in
// the agent's instructions file, between two marker lines (MarkedBlock).
// Each start replaces the block, so it is there once however often the
// engine starts and whether or not the seeder rewrote the file first; an
// image without a note gets the block removed. Pure JVM.
object OsNote {
  const val BEGIN = "<!-- phonecando:os-note -->"
  const val END = "<!-- /phonecando:os-note -->"

  private val block = MarkedBlock(BEGIN, END)

  /** Writes `instructions` only when its text changes. */
  fun apply(instructions: File, note: File) {
    val noteText = try {
      if (note.isFile) note.readText(Charsets.UTF_8) else null
    } catch (_: Exception) {
      null
    }
    block.apply(instructions, noteText)
  }

  /** `instructions` with the note's block in place of any old one, or without it when there is no note. */
  fun merge(instructions: String?, note: String?): String = block.merge(instructions, note)
}
