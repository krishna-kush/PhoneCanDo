package com.phonecando.runner.engine.image

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test
import java.io.File
import java.nio.file.Files

// JVM checks for the OS note in the agent's instructions: once, replaced,
// removed, whether or not the seeder rewrote the file in between.
class OsNoteTest {
  private val root = Files.createTempDirectory("osnote").toFile()
  private val agents = File(root, "home/.config/opencode/AGENTS.md")
  private val note = File(root, "run/os-note.md")

  @After fun cleanup() {
    root.deleteRecursively()
  }

  private fun block(text: String) = "${OsNote.BEGIN}\n$text\n${OsNote.END}\n"

  @Test fun appendedOnceOverManyStarts() {
    agents.parentFile.mkdirs()
    agents.writeText("# Agent\nBe brief.\n")
    note.parentFile.mkdirs()
    note.writeText("Debian 13, apt-get install -y <pkg>, no systemd.\n")
    repeat(3) { OsNote.apply(agents, note) }
    assertEquals("# Agent\nBe brief.\n\n" + block("Debian 13, apt-get install -y <pkg>, no systemd."), agents.readText())
  }

  @Test fun reseededFileGetsTheNoteAgain() {
    agents.parentFile.mkdirs()
    note.parentFile.mkdirs()
    note.writeText("Alpine 3.22")
    agents.writeText("# Agent\n")
    OsNote.apply(agents, note)
    // The seeder writes the shipped file again on the next start.
    agents.writeText("# Agent\n")
    OsNote.apply(agents, note)
    assertEquals("# Agent\n\n" + block("Alpine 3.22"), agents.readText())
  }

  @Test fun changedNoteReplacesTheBlock() {
    agents.parentFile.mkdirs()
    note.parentFile.mkdirs()
    agents.writeText("# Agent")
    note.writeText("Debian 12")
    OsNote.apply(agents, note)
    note.writeText("Debian 13")
    OsNote.apply(agents, note)
    assertEquals("# Agent\n\n" + block("Debian 13"), agents.readText())
  }

  @Test fun noNoteRemovesTheBlock() {
    agents.parentFile.mkdirs()
    agents.writeText("# Agent\n\n" + block("Debian 13"))
    OsNote.apply(agents, note)
    assertEquals("# Agent\n", agents.readText())
  }

  @Test fun noFileAndNoNoteWritesNothing() {
    OsNote.apply(agents, note)
    assertFalse(agents.exists())
  }

  @Test fun noteWithoutInstructionsCreatesTheFile() {
    note.parentFile.mkdirs()
    note.writeText("Fedora 42")
    OsNote.apply(agents, note)
    assertEquals(block("Fedora 42"), agents.readText())
  }

  @Test fun textAfterTheBlockSurvivesAndTheBlockKeepsItsPlace() {
    assertEquals("a\n\n" + block("n") + "b\n", OsNote.merge("a\n\n" + block("old") + "b\n", "n"))
    assertEquals("a\n\nb\n", OsNote.merge("a\n\n" + block("old") + "b\n", null))
  }
}
