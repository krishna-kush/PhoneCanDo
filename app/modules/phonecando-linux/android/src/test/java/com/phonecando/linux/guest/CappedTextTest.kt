package com.phonecando.linux.guest

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.ByteArrayInputStream

// JVM checks for a guest command's capped stdout.
class CappedTextTest {
  private fun read(text: String, maxBytes: Int): Pair<String, Int> {
    val stream = ByteArrayInputStream(text.toByteArray())
    val capped = CappedText(maxBytes)
    capped.readFrom(stream)
    return capped.text() to stream.available()
  }

  @Test fun shortOutputIsKeptWhole() {
    assertEquals("v1.2.3\n" to 0, read("v1.2.3\n", 64))
  }

  @Test fun readingStopsAtTheCapAndLeavesTheRest() {
    assertEquals("abcd" to 4, read("abcdefgh", 4))
  }

  @Test fun aCharacterTheCapSplitsIsLeftOut() {
    // "aé€": a (1 byte), é (2), € (3); a cap of 5 cuts the €.
    assertEquals("aé", read("aé€", 5).first)
    assertEquals("aé€", read("aé€", 6).first)
    assertEquals("a", read("aé", 2).first)
  }
}
