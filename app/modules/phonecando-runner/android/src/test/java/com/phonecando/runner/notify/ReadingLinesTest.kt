package com.phonecando.runner.notify

import org.junit.Assert.assertEquals
import org.junit.Test

class ReadingLinesTest {
  @Test fun aReadingShowsItsCountOnceThereIsOne() {
    assertEquals("Qwen3.5 4B · reading the prompt", ReadingLines.of("Qwen3.5 4B", 0))
    assertEquals("Qwen3.5 4B · reading the prompt, 4.1k tokens so far", ReadingLines.of("Qwen3.5 4B", 4_096))
  }

  @Test fun tokens() {
    assertEquals("950", ReadingLines.tokens(950))
    assertEquals("1.0k", ReadingLines.tokens(1_000))
    assertEquals("12.3k", ReadingLines.tokens(12_345))
  }
}
