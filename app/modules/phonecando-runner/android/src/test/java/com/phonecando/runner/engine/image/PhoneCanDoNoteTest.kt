package com.phonecando.runner.engine.image

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.File
import java.nio.file.Files

// JVM checks for the note on PhoneCanDo in every agent's instructions: which
// parts an agent gets, its name and kind filled in, and the block in the file.
class PhoneCanDoNoteTest {
  private val root = Files.createTempDirectory("pcdnote").toFile()
  private val agents = File(root, "home/.config/opencode/AGENTS.md")

  @After fun cleanup() {
    root.deleteRecursively()
  }

  private fun facts(linux: Boolean = true, full: Boolean = true, phoneTools: Boolean = true) =
    PhoneCanDoNote.Facts("Bolt", "opencode", linux, full, phoneTools)

  @Test fun partsFollowTheMachineTheBuildAndTheTools() {
    assertEquals(
      listOf("about.md", "machine-linux.md", "phone-control.md", "agents.md"),
      PhoneCanDoNote.parts(facts()),
    )
    assertEquals(
      listOf("about.md", "machine-android.md", "phone-basic.md", "agents.md"),
      PhoneCanDoNote.parts(facts(linux = false, full = false)),
    )
    // No phone tools: no bridge, so neither phone part nor other agents.
    assertEquals(listOf("about.md", "machine-linux.md"), PhoneCanDoNote.parts(facts(phoneTools = false)))
  }

  @Test fun bodyJoinsThePartsAndFillsInTheAgent() {
    val parts = mapOf(
      "about.md" to "## About\nYou are {{name}}, a {{kind}} agent.\n",
      "machine-linux.md" to "- Linux.\n",
      "agents.md" to "  \n",
    )
    assertEquals(
      "## About\nYou are Bolt, a opencode agent.\n\n- Linux.",
      PhoneCanDoNote.body(facts(), parts::get),
    )
  }

  @Test fun noPartsNoNote() {
    assertNull(PhoneCanDoNote.body(facts()) { null })
  }

  @Test fun theBlockIsWrittenOnceAndGoesWithoutParts() {
    agents.parentFile.mkdirs()
    agents.writeText("# Agent\n")
    repeat(2) { PhoneCanDoNote.apply(agents, "About PhoneCanDo.") }
    assertEquals("# Agent\n\n${PhoneCanDoNote.BEGIN}\nAbout PhoneCanDo.\n${PhoneCanDoNote.END}\n", agents.readText())
    PhoneCanDoNote.apply(agents, null)
    assertEquals("# Agent\n", agents.readText())
  }
}
