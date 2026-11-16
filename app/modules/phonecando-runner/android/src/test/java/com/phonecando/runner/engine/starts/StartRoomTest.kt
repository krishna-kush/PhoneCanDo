package com.phonecando.runner.engine.starts

import com.phonecando.runner.memory.MemoryPolicy
import com.phonecando.runner.memory.MemoryReading
import com.phonecando.runner.memory.MemoryRules
import com.phonecando.runner.memory.MemoryRules.MIB
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// A start nobody asked for in the app needs the memory guard's ok line plus
// an engine's room, and stays under your cap rather than make room.
class StartRoomTest {
  // An 8 GB phone as it reports, with our test phone's threshold.
  private val total = 7_562_532L * 1024
  private val okFrom = MemoryPolicy.lines(MemoryReading(total, 0, 216 * MIB, false)).okFrom

  private fun reading(avail: Long, low: Boolean = false) = MemoryReading(total, avail, 216 * MIB, low)

  @Test fun roomIsTheOkLinePlusAnEnginesRoom() {
    assertEquals(512 * MIB, MemoryRules.START_ROOM)
    assertNull(StartRoom.refusal(StartRoom.Look(reading(okFrom + MemoryRules.START_ROOM), 0, null)))
    val short = StartRoom.refusal(StartRoom.Look(reading(okFrom + MemoryRules.START_ROOM - 1), 0, null))
    assertEquals("the phone is short of memory", short)
    assertEquals(short, StartRoom.refusal(StartRoom.Look(reading(total / 2, low = true), 0, null)))
    // No reading from Android is no reason to refuse.
    assertNull(StartRoom.refusal(StartRoom.Look(null, 0, null)))
  }

  @Test fun atYourCapItIsRefusedRatherThanStopAnotherAgent() {
    val plenty = reading(total / 2)
    assertNull(StartRoom.refusal(StartRoom.Look(plenty, 2, 3)))
    assertEquals("3 agents are running, the most the user set in Settings", StartRoom.refusal(StartRoom.Look(plenty, 3, 3)))
    assertEquals("1 agent is running, the most the user set in Settings", StartRoom.refusal(StartRoom.Look(plenty, 1, 1)))
    assertNull(StartRoom.refusal(StartRoom.Look(plenty, 40, null)))
  }
}
