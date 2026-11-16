package com.phonecando.runner.cutoff

import com.phonecando.runner.engine.EngineMode
import com.phonecando.runner.schedule.StateFile
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File
import java.nio.file.Files

// The record's file: every field round-trips, a run that does not read is
// left out, and a file that does not read is empty.
class CutOffStoreTest {
  private val dir: File = Files.createTempDirectory("cutoffs").toFile()
  private val file = File(dir, "state/cut-off-runs.json")

  @Test fun everyFieldRoundTrips() {
    val book = CutOffBook(
      runs = listOf(
        CutOffRun("a1", null, null, EngineMode.TERMINAL, 1, 2, "l1", null),
        CutOffRun("a2", "ses_1", "fix the build", EngineMode.ACP, 3, 4, "l2", 7, scheduleRun = 12, diedAt = 5, held = Held.SYSTEM, checkedAt = 6),
      ),
      brought = mapOf("a2" to listOf(10L, 20L)),
    )
    CutOffStore(StateFile(file)).save(book)
    assertEquals(book, CutOffStore(StateFile(file)).load())
  }

  @Test fun whatDoesNotReadIsLeftOut() {
    File(dir, "state").mkdirs()
    file.writeText(
      """{"runs":[{"agentId":"a1","life":"l1","mode":"terminal","startedAt":1,"seenAt":1},""" +
        """{"agentId":"a2","life":"l1","mode":"warp","startedAt":1,"seenAt":1},{"life":"l1"}],"brought":{"a1":[]}}""",
    )
    val book = CutOffStore(StateFile(file)).load()
    assertEquals(listOf("a1"), book.runs.map { it.agentId })
    assertEquals(emptyMap<String, List<Long>>(), book.brought)
    file.writeText("not json")
    assertEquals(CutOffBook(), CutOffStore(StateFile(file)).load())
    assertEquals(CutOffBook(), CutOffStore(StateFile(File(dir, "missing.json"))).load())
  }
}
