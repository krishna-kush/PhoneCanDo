package com.phonecando.runner.engine.image

import com.phonecando.runner.engine.image.MachineNote.Mate
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

// JVM checks for the machine-mates note in an agent's instructions: who it
// is and who else is there, added once, replaced in place, removed when the
// agent is alone, and kept apart from the OS note.
class MachineNoteTest {
  private val root = Files.createTempDirectory("machinenote").toFile()
  private val agents = File(root, "home/.claude/CLAUDE.md")
  private val me = Mate("Ann", "Claude Code")
  private val bob = Mate("Bob", "opencode")
  private val cy = Mate("Cy", "Claude Code")

  @After fun cleanup() {
    root.deleteRecursively()
  }

  private fun block(body: String) = "${MachineNote.BEGIN}\n$body\n${MachineNote.END}\n"

  @Test fun theNoteNamesTheAgentAndItsMates() {
    val body = checkNotNull(MachineNote.body(me, listOf(bob, cy)))
    val lines = body.lines()
    assertEquals("## Other agents on this machine", lines[0])
    assertEquals(
      "You are \"Ann\" (Claude Code). This machine is shared with \"Bob\" (opencode), \"Cy\" (Claude Code). " +
        "They may be working in ~/projects at the same time as you.",
      lines[1],
    )
    assertTrue(lines[2].startsWith("- Work on your own git branch, ideally in your own worktree (`git worktree add ../<repo>-<your name> -b <branch>`)"))
    assertEquals("- Don't stop or restart processes you didn't start.", lines[3])
    assertTrue(lines[4].startsWith("- Ask the user before system-wide installs or upgrades with the package manager"))
    assertEquals(5, lines.size)
    // A name never breaks the note's lines.
    assertTrue(MachineNote.body(Mate("A\nB", "x"), listOf(bob))!!.contains("You are \"A B\" (x)."))
    assertNull(MachineNote.body(me, emptyList()))
  }

  @Test fun addedOnceOverManyWrites() {
    agents.parentFile.mkdirs()
    agents.writeText("# Mine\n")
    val body = MachineNote.body(me, listOf(bob))
    repeat(3) { MachineNote.apply(agents, body) }
    assertEquals("# Mine\n\n" + block(body!!), agents.readText())
  }

  @Test fun aNewMateReplacesTheBlockInPlace() {
    val first = MachineNote.merge("# Mine\n", MachineNote.body(me, listOf(bob)))
    val withAfter = "$first\nMy own notes.\n"
    val next = MachineNote.merge(withAfter, MachineNote.body(me, listOf(bob, cy)))
    assertEquals("# Mine\n\n" + block(MachineNote.body(me, listOf(bob, cy))!!) + "\nMy own notes.\n", next)
  }

  @Test fun anAgentAloneGetsTheBlockRemoved() {
    agents.parentFile.mkdirs()
    agents.writeText("# Mine\n\n" + block(MachineNote.body(me, listOf(bob))!!))
    MachineNote.apply(agents, MachineNote.body(me, emptyList()))
    assertEquals("# Mine\n", agents.readText())
    // No file and nobody else: nothing is written.
    val none = File(root, "home/other/AGENTS.md")
    MachineNote.apply(none, null)
    assertFalse(none.exists())
  }

  @Test fun itKeepsItsPlaceBesideTheOsNote() {
    val os = "${OsNote.BEGIN}\nDebian 13\n${OsNote.END}\n"
    val mates = block(MachineNote.body(me, listOf(bob))!!)
    var text = MachineNote.merge(OsNote.merge("# Mine\n", "Debian 13"), MachineNote.body(me, listOf(bob)))
    assertEquals("# Mine\n\n$os\n$mates", text)
    // Every start writes both again; the file stays as it is.
    repeat(2) { text = MachineNote.merge(OsNote.merge(text, "Debian 13"), MachineNote.body(me, listOf(bob))) }
    assertEquals("# Mine\n\n$os\n$mates", text)
    // A note that goes leaves the other one whole.
    assertEquals("# Mine\n\n$mates", OsNote.merge(text, null))
    assertEquals("# Mine\n\n$os", MachineNote.merge(text, null))
  }
}
