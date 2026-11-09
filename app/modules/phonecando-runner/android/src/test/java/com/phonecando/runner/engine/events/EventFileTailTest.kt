package com.phonecando.runner.engine.events

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

// JVM checks for following an events file: whole lines only, from the
// start again after the file was emptied, an over-long line dropped whole.
class EventFileTailTest {
  private val root = Files.createTempDirectory("events").toFile()
  private val file = File(root, "events")
  private val lines = ArrayList<String>()
  private val tail = EventFileTail(file, lines::add)

  @After fun cleanup() {
    root.deleteRecursively()
  }

  @Test fun wholeLinesAsTheyCome() {
    tail.poll() // no file yet
    file.appendText("Stop\ts\tdone\nNotifi")
    tail.poll()
    assertEquals(listOf("Stop\ts\tdone"), lines)
    file.appendText("cation\t\t\n@open\thttps://example.com/é\n")
    tail.poll()
    tail.poll()
    assertEquals(listOf("Stop\ts\tdone", "Notification\t\t", "@open\thttps://example.com/é"), lines)
  }

  @Test fun anEmptiedFileIsReadFromItsStart() {
    file.writeText("one\ntwo\n")
    tail.poll()
    file.writeText("")
    tail.poll()
    file.writeText("three\n")
    tail.poll()
    assertEquals(listOf("one", "two", "three"), lines)
  }

  @Test fun anOverLongLineIsDroppedWhole() {
    file.writeText("x".repeat(EventLine.MAX_BYTES + 10) + "\nnext\n" + "y".repeat(EventLine.MAX_BYTES) + "\n")
    tail.poll()
    assertEquals(listOf("next", "y".repeat(EventLine.MAX_BYTES)), lines)
  }

  @Test fun aBigBurstIsReadOverSeveralLooks() {
    val many = (1..20_000).map { "e$it" }
    file.writeText(many.joinToString("\n", postfix = "\n"))
    tail.poll()
    assertTrue(lines.size < many.size)
    repeat(4) { tail.poll() }
    assertEquals(many, lines)
  }
}
