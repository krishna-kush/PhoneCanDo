package com.phonecando.runner.checks.life

import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

// S6: what the launch seeded never counts; anything the agent wrote in its
// own folder after the launch does, but the machine note other launches
// write into its instructions file.
class StateProbeTest {
  private val dir = Files.createTempDirectory("state").toFile()
  private val since = 1_700_000_000_000L
  private val before = since - 60_000
  private val after = since + 60_000

  @After fun cleanup() {
    dir.deleteRecursively()
  }

  private fun file(path: String, at: Long) = File(dir, path).apply {
    parentFile?.mkdirs()
    writeText("x")
    setLastModified(at)
  }

  // Folders as the launch left them: a write in them moves their time on.
  private fun folders(at: Long, vararg paths: String) {
    for (path in paths) File(dir, path).setLastModified(at)
    dir.setLastModified(at)
  }

  @Test fun whatTheLaunchSeededDoesNotCount() {
    file("claude/settings.json", before)
    file("claude/CLAUDE.md", before)
    folders(before, "claude")
    assertFalse(StateProbe(dir, since).wrote())
  }

  @Test fun aFileWrittenThisLifeCounts() {
    file("claude/settings.json", before)
    file("claude/projects/p/chat.jsonl", after)
    folders(before, "claude", "claude/projects", "claude/projects/p")
    assertTrue(StateProbe(dir, since).wrote())
  }

  @Test fun aNewEntryCountsByItsFolder() {
    file("claude/settings.json", before)
    folders(before, "claude")
    // A removal or rename leaves only its folder's time.
    File(dir, "claude").setLastModified(after)
    assertTrue(StateProbe(dir, since).wrote())
  }

  @Test fun theInstructionsFileAndItsFolderDoNotCount() {
    val note = file("claude/CLAUDE.md", after)
    folders(before)
    File(dir, "claude").setLastModified(after)
    assertFalse(StateProbe.of(dir, since, note).wrote())
    assertTrue(StateProbe.of(dir, since, null).wrote())
  }

  @Test fun noFolderWroteNothing() {
    assertFalse(StateProbe(File(dir, "none"), since).wrote())
  }
}
