package com.phonecando.runner.notify

import org.junit.Assert.assertEquals
import org.junit.Test

class ReadingLinesTest {
  @Test fun aReadingShowsHowFarOfTheWhole() {
    assertEquals("Qwen3.5 4B · reading the prompt, 0%, 0 of 12.3k tokens", ReadingLines.of("Qwen3.5 4B", 0, 12_345).line)
    assertEquals("Qwen3.5 4B · reading the prompt, 33%, 4.1k of 12.3k tokens", ReadingLines.of("Qwen3.5 4B", 4_096, 12_345).line)
    assertEquals("Qwen3.5 4B · reading the prompt, 99%, 12.3k of 12.3k tokens", ReadingLines.of("Qwen3.5 4B", 12_344, 12_345).line)
    assertEquals("Qwen3.5 4B · reading the prompt, 100%, 950 of 950 tokens", ReadingLines.of("Qwen3.5 4B", 2_048, 950).line)
  }

  @Test fun withoutAWholeItShowsItsCountOnceThereIsOne() {
    assertEquals("Qwen3.5 4B · reading the prompt", ReadingLines.of("Qwen3.5 4B", 0, null).line)
    assertEquals("Qwen3.5 4B · reading the prompt, 4.1k tokens so far", ReadingLines.of("Qwen3.5 4B", 4_096, null).line)
  }

  @Test fun itsItemLandsOnTheHomeOfTheOneAgentItReadsFor() {
    val one = ReadingLines.item("m1", "Qwen3.5 4B", 4_096, 12_345, listOf("a1"))
    assertEquals("reading:m1", one.key)
    assertEquals(LaunchTarget("home", "a1"), one.target)
    assertEquals(ServiceItem.Bar(33), one.bar)
    assertEquals(null, ReadingLines.item("m1", "Qwen3.5 4B", 0, null, listOf("a1", "a2")).target)
  }

  @Test fun tokens() {
    assertEquals("950", ReadingLines.tokens(950))
    assertEquals("1.0k", ReadingLines.tokens(1_000))
    assertEquals("12.3k", ReadingLines.tokens(12_345))
  }
}
