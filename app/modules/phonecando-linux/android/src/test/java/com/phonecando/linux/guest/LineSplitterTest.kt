package com.phonecando.linux.guest

import org.junit.Assert.assertEquals
import org.junit.Test

// JVM checks for cutting guest output into lines.
class LineSplitterTest {
  private fun split(vararg chunks: String, maxBytes: Int = LineSplitter.MAX_LINE_BYTES): List<String> {
    val lines = ArrayList<String>()
    val splitter = LineSplitter(maxBytes) { lines += it }
    chunks.forEach { val b = it.toByteArray(); splitter.feed(b, b.size) }
    splitter.finish()
    return lines
  }

  @Test fun everyLineBreakEndsALineAndBlankLinesGo() {
    assertEquals(listOf("a", "b", "c", "d"), split("a\nb\r\n\nc\r", "d"))
  }

  @Test fun aLineSplitAcrossChunksStaysWhole() {
    assertEquals(listOf("hello world"), split("hel", "lo wo", "rld\n"))
  }

  @Test fun aProgressBarDrawnOverItselfIsOneLinePerDraw() {
    assertEquals(listOf(" 10%", " 50%", "100%"), split(" 10%\r 50%\r100%\n"))
  }

  @Test fun aLongLineKeepsItsStart() {
    assertEquals(listOf("abcd", "ok"), split("abcdefgh\nok\n", maxBytes = 4))
  }

  @Test fun utf8SplitAcrossChunksDecodesWhole() {
    val bytes = "größe\n".toByteArray()
    val lines = ArrayList<String>()
    val splitter = LineSplitter { lines += it }
    splitter.feed(bytes.copyOfRange(0, 3), 3)
    splitter.feed(bytes.copyOfRange(3, bytes.size), bytes.size - 3)
    assertEquals(listOf("größe"), lines)
  }
}
