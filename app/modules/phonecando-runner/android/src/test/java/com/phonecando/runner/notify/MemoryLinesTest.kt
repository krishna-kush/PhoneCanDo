package com.phonecando.runner.notify

import org.junit.Assert.assertEquals
import org.junit.Test

class MemoryLinesTest {
  @Test fun theWarningSaysWhenWeStepIn() {
    assertEquals(
      "Your phone is running out of memory. Stop an agent or two, or we'll tuck the sleepiest one in for you in a minute.",
      MemoryLines.warn(60_000),
    )
    assertEquals(
      "Your phone is running out of memory. Stop an agent or two, or we'll tuck the sleepiest one in for you in a moment.",
      MemoryLines.warn(15_000),
    )
    assertEquals("Your phone is running out of memory. Stop an agent or two to give it some room.", MemoryLines.warn(null))
  }

  @Test fun whatWeStopped() {
    assertEquals("We stopped Coder to free memory. Start it again whenever you like.", MemoryLines.stopped(listOf("Coder")))
    assertEquals(
      "We stopped Coder and Helper to free memory. Start them again whenever you like.",
      MemoryLines.stopped(listOf("Coder", "Helper")),
    )
    assertEquals("A, B and C", MemoryLines.list(listOf("A", "B", "C")))
  }
}
