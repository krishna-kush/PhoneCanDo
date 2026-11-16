package com.phonecando.models.api

import com.phonecando.lme.api.model.KvCacheChoice
import com.phonecando.lme.api.model.RamShare
import com.phonecando.lme.api.model.ServeChoices
import com.phonecando.models.memory.MemoryTraits
import com.phonecando.models.memory.MemoryView
import com.phonecando.models.ram.RamCheck
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class MemoryMapsTest {
  @Test
  fun `choices go by name, and a number left out is Auto`() {
    val mine = ServeChoices(RamShare.MORE, KvCacheChoice.HALF, savedPrompts = 0, checkpoints = 8, threads = 2, detailedLog = true)
    assertEquals(
      mapOf("ramShare" to "more", "kvCache" to "half", "savedPrompts" to 0, "checkpoints" to 8, "threads" to 2),
      mine.toMap(),
    )
    // From JS numbers are doubles; the log switch is kept from the record.
    val raw = mapOf("ramShare" to "more", "kvCache" to "half", "savedPrompts" to 0.0, "checkpoints" to 8.0, "threads" to 2.0)
    assertEquals(mine, serveChoices(raw, detailedLog = true))
    assertEquals(ServeChoices.AUTO, serveChoices(emptyMap(), detailedLog = false))
    assertEquals(ServeChoices.AUTO, serveChoices(mapOf("savedPrompts" to null, "ramShare" to "normal"), detailedLog = false))
  }

  @Test
  fun `a choice it does not know is refused`() {
    for (raw in listOf(
      mapOf("ramShare" to "most"),
      mapOf("kvCache" to 1.0),
      mapOf("threads" to 2.5),
      mapOf("savedPrompts" to "two"),
      mapOf("checkpoints" to 0.0),
    )) {
      assertThrows(IllegalArgumentException::class.java) { serveChoices(raw, detailedLog = false) }
    }
  }

  @Test
  fun `the line and the traits as JS reads them`() {
    val view = MemoryView(32_768, true, 1, 4, 4, 3_000_000_000, true, RamCheck(RamCheck.Verdict.FITS, 2_000_000_000, 3_000_000_000), 4, true)
    assertEquals(
      mapOf(
        "context" to 32_768.0, "halfKvCache" to true, "savedPrompts" to 1, "checkpoints" to 4, "threads" to 4, "totalBytes" to 3e9,
        "freeMemoryLimits" to true,
        "ram" to mapOf("verdict" to "fits", "needBytes" to 2e9, "budgetBytes" to 3e9),
        "storedChats" to 4, "measured" to true,
      ),
      view.toMap(),
    )
    val traits = MemoryTraits(
      MemoryTraits.Choice(0..3, 2), null, false, MemoryTraits.Choice(1..8, 4),
      mapOf(RamShare.LESS to 1L, RamShare.NORMAL to 2L, RamShare.MORE to 3L),
    )
    assertEquals(
      mapOf(
        "savedPrompts" to mapOf("min" to 0, "max" to 3, "auto" to 2),
        "checkpoints" to null,
        "halfKvCache" to false,
        "threads" to mapOf("min" to 1, "max" to 8, "auto" to 4),
        "budgets" to mapOf("less" to 1.0, "normal" to 2.0, "more" to 3.0),
      ),
      traits.toMap(),
    )
  }
}
