package com.phonecando.runner.schedule

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDateTime
import java.time.ZoneOffset

// A timing as the model reads it in a task's note, and a Run now as when it ran.
class TimingTextTest {
  private val zone = ZoneOffset.ofHours(1)
  private fun at(text: String) = LocalDateTime.parse(text).toInstant(zone).toEpochMilli()

  @Test fun aOnceSaysItsTime() {
    assertEquals("once at 2026-11-14 09:00", TimingText.of(Timing.Once(at("2026-11-14T09:00:00")), zone))
  }

  @Test fun aRunNowSaysWhenItRanNotItsTiming() {
    assertEquals("run now at 2026-11-15 14:03", TimingText.ranNow(at("2026-11-15T14:03:59"), zone))
  }
}
