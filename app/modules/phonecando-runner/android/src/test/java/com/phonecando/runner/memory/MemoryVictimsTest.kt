package com.phonecando.runner.memory

import com.phonecando.runner.memory.MemoryRules.MIB
import com.phonecando.runner.memory.MemoryVictims.Candidate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// Who the memory guard stops first, and what each stop gives back.
class MemoryVictimsTest {
  @Test fun victimsWithoutARunFirstThenLeastRecentlyUsed() {
    val agents = listOf(
      Candidate("busy-old", working = true, lastUsedAt = 100),
      Candidate("quiet-new", working = false, lastUsedAt = 900),
      Candidate("quiet-old", working = false, lastUsedAt = 200),
      Candidate("busy-new", working = true, lastUsedAt = 800),
    )
    assertEquals("quiet-old", MemoryVictims.victim(agents, null))
    assertEquals("quiet-new", MemoryVictims.victim(agents.filter { it.agentId != "quiet-old" }, null))
    assertEquals("busy-old", MemoryVictims.victim(agents.filter { !it.agentId.startsWith("quiet") }, null))
    // Never used counts as oldest.
    assertEquals("never", MemoryVictims.victim(agents + Candidate("never", false, null), null))
  }

  @Test fun agentsWithAJobLeftGoAfterThoseWithNothing() {
    val agents = listOf(
      Candidate("server-old", working = false, lastUsedAt = 100, busy = true),
      Candidate("nothing-new", working = false, lastUsedAt = 900),
      Candidate("working", working = true, lastUsedAt = 50),
    )
    assertEquals("nothing-new", MemoryVictims.victim(agents, null))
    assertEquals("server-old", MemoryVictims.victim(agents.filter { it.agentId != "nothing-new" }, null))
  }

  @Test fun aStopThatFreesWhatIsShortGoesFirstAmongEquals() {
    // Short of 1 GiB: the idle agent alone on a 2 GiB model goes before an older one that frees little.
    val agents = listOf(
      Candidate("small-old", working = false, lastUsedAt = 100, frees = 200 * MIB),
      Candidate("model-new", working = false, lastUsedAt = 900, frees = 2_300 * MIB),
      Candidate("working", working = true, lastUsedAt = 50, frees = 3_000 * MIB),
    )
    assertEquals("model-new", MemoryVictims.victim(agents, null, shortBytes = 1_024 * MIB))
    // Each frees enough: the least recently used of them.
    assertEquals("small-old", MemoryVictims.victim(agents, null, shortBytes = 100 * MIB))
    // None frees enough: the one that frees the most.
    val little = listOf(
      Candidate("a", working = false, lastUsedAt = 100, frees = 100 * MIB),
      Candidate("b", working = false, lastUsedAt = 900, frees = 300 * MIB),
    )
    assertEquals("b", MemoryVictims.victim(little, null, shortBytes = 1_024 * MIB))
    // Bytes unread: least recently used, as before.
    assertEquals("a", MemoryVictims.victim(little.map { it.copy(frees = null) }, null, shortBytes = 1_024 * MIB))
    // Memory never outranks work: the working one still goes last.
    assertEquals("small-old", MemoryVictims.victim(agents.filter { it.agentId != "model-new" }, null, shortBytes = 1_024 * MIB))
  }

  @Test fun theAgentOnScreenIsSparedButNotAtTheCostOfOneAtWork() {
    // An idle agent on screen goes before one at work in the background.
    val agents = listOf(Candidate("open", false, 1), Candidate("other", true, 999))
    assertEquals("open", MemoryVictims.victim(agents, keep = "open"))
    // Another idle agent goes first.
    assertEquals("idle", MemoryVictims.victim(agents + Candidate("idle", false, 500), keep = "open"))
    // At work on screen, or alone there: never.
    assertEquals("other", MemoryVictims.victim(listOf(Candidate("open", true, 1), Candidate("other", true, 999)), keep = "open"))
    assertNull(MemoryVictims.victim(listOf(Candidate("open", true, 1)), keep = "open"))
    assertNull(MemoryVictims.victim(listOf(Candidate("open", false, 1)), keep = "open"))
    assertNull(MemoryVictims.victim(emptyList(), null))
  }

  @Test fun aStopFreesItsProcessesAndTheModelsOnlyItHolds() {
    val bytes = ProcessMemory.Owners(mapOf("a1" to 300 * MIB, "a2" to 200 * MIB), mapOf("qwen" to 2_000 * MIB, "gemma" to 3_000 * MIB))
    val models = listOf(
      MemoryModel("qwen", "Qwen", null, listOf("a1"), ready = true),
      MemoryModel("gemma", "Gemma", null, listOf("a1", "a2"), ready = true),
    )
    // a1 alone holds qwen; gemma, shared, stays up for a2.
    assertEquals(2_300 * MIB, MemoryVictims.freed("a1", bytes, models))
    assertEquals(200 * MIB, MemoryVictims.freed("a2", bytes, models))
    // An engine with no process read yet frees what its model takes.
    assertEquals(2_000 * MIB, MemoryVictims.freed("a3", bytes, listOf(MemoryModel("qwen", "Qwen", null, listOf("a3"), ready = false))))
    assertNull(MemoryVictims.freed("a1", null, models))
  }
}
