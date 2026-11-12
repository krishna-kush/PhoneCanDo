package com.phonecando.linux.guest

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

// JVM checks for reading the end of logs/install.log back for the Install page.
class ScriptLogEndTest {
  @get:Rule val tmp = TemporaryFolder()

  @Test fun noLogBeforeAnyScript() {
    assertNull(ScriptLogEnd.read(File(tmp.root, "logs/install.log")))
  }

  @Test fun aShortLogComesBackWhole() {
    val file = File(tmp.root, "install.log")
    ScriptLog(file, "install gemini").use { it.line("one") }
    val end = ScriptLogEnd.read(file)!!
    assertEquals("# install gemini\none", end.text)
    assertFalse(end.cut)
    assertEquals(file.lastModified(), end.modifiedAt)
  }

  @Test fun aLongLogKeepsWholeLinesFromTheEnd() {
    val file = File(tmp.root, "install.log")
    file.writeText("# x\naaaa\nbbbb\ncccc\n")
    // The last 12 bytes start inside "aaaa": that partial line is left out.
    val end = ScriptLogEnd.read(file, maxBytes = 12)!!
    assertEquals("bbbb\ncccc", end.text)
    assertTrue(end.cut)
  }
}
