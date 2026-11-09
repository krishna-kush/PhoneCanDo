package com.phonecando.linux.guest

import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

// JVM checks for logs/install.log: a fresh log per script, flushed as it goes, capped.
class ScriptLogTest {
  @get:Rule val tmp = TemporaryFolder()

  @Test fun eachScriptStartsAFreshLogWithItsLabel() {
    val file = File(tmp.root, "logs/install.log")
    ScriptLog(file, "install old").use { it.line("old line") }
    val log = ScriptLog(file, "update gemini")
    log.line("one")
    // Flushed per line: a kill keeps what was printed.
    assertEquals("# update gemini\none\n", file.readText())
    log.close()
    log.line("after close")
    assertEquals("# update gemini\none\n", file.readText())
  }

  @Test fun theLogStopsAtItsCapWithOneLineSayingSo() {
    val file = File(tmp.root, "install.log")
    ScriptLog(file, "x", maxBytes = 12).use { log -> listOf("12345", "678", "9").forEach(log::line) }
    assertEquals("# x\n12345\n[log cut at 12 bytes]\n", file.readText())
  }
}
