package com.phonecando.runner.memory

import com.phonecando.lme.host.ram.RamGate
import com.phonecando.lme.host.ram.RamRules
import com.phonecando.runner.memory.MemoryRules.MIB
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// lme sizes a model's start (its automatic context and prompt cache) to
// leave free what the guard needs to stay at ok, plus room for the agent's
// own engine, so a model never starts the guard's countdown by itself. A
// change to either side's numbers that breaks this fails here.
class MemoryHeadroomTest {
  private val gib = 1L shl 30

  @Test fun aModelStartLeavesTheGuardAtOk() {
    assertTrue(RamRules.KEEP_FREE_PERCENT >= MemoryRules.WARN_PERCENT + MemoryRules.OK_HYSTERESIS_PERCENT)
    // Phones sold as 8, 12 and 16 GB, as they report; a threshold of 216 MiB, as our test phone's.
    for (total in listOf(7_562_532L * 1024, 11L * gib + gib / 5, 15L * gib)) {
      val okFrom = MemoryPolicy.lines(MemoryReading(total, 0, 216 * MIB, false)).okFrom
      // Within a MiB: each side rounds its percentages its own way.
      assertTrue("$total", RamGate.keepFree(total) - RamRules.FREE_MARGIN_MIB * MIB >= okFrom - MIB)
    }
  }

  // A message's start waits for the room lme leaves an agent's engine.
  @Test fun aMessagesStartWantsTheRoomLmeLeavesAnEngine() {
    assertEquals(RamRules.FREE_MARGIN_MIB * MIB, MemoryRules.START_ROOM)
  }
}
