package com.phonecando.runner.engine.image

import java.io.File

// The "other agents on this machine" note in an agent's instructions file,
// between two marker lines (MarkedBlock): who the agent is, who else works
// on its machine, and how to keep out of their way there (its own branch or
// worktree, processes it did not start, system-wide installs). An agent
// alone on its machine gets the block removed. MachineNotes keeps it
// current for every agent on a machine. Pure JVM.
object MachineNote {
  const val BEGIN = "<!-- phonecando:machine-mates -->"
  const val END = "<!-- /phonecando:machine-mates -->"

  private val block = MarkedBlock(BEGIN, END)
  private val SPACES = Regex("\\s+")

  /** An agent as the note names it: its name and its kind's label. */
  data class Mate(val name: String, val label: String)

  /** The note for [self] on a machine shared with [others]; null when it is alone there. */
  fun body(self: Mate, others: List<Mate>): String? {
    if (others.isEmpty()) return null
    val shared = others.joinToString(", ") { named(it) }
    return listOf(
      "## Other agents on this machine",
      "You are ${named(self)}. This machine is shared with $shared. " +
        "They may be working in ~/projects at the same time as you.",
      "- Work on your own git branch, ideally in your own worktree " +
        "(`git worktree add ../<repo>-<your name> -b <branch>`), " +
        "and tell the user before you merge into a branch another agent uses.",
      "- Don't stop or restart processes you didn't start.",
      "- Ask the user before system-wide installs or upgrades with the package manager: " +
        "they change tools the other agents use.",
    ).joinToString("\n")
  }

  /** Writes `instructions` only when its text changes; [body] null removes the block. */
  fun apply(instructions: File, body: String?) = block.apply(instructions, body)

  fun merge(instructions: String?, body: String?): String = block.merge(instructions, body)

  // `"Name" (Label)` on one line, whatever the name holds.
  private fun named(mate: Mate) = "\"${flat(mate.name)}\" (${flat(mate.label)})"

  private fun flat(text: String) = text.replace(SPACES, " ").trim()
}
