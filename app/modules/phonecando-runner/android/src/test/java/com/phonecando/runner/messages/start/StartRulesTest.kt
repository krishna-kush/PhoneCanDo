package com.phonecando.runner.messages.start

import com.phonecando.runner.engine.EngineMode
import com.phonecando.runner.messages.MessageRules
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Which stopped agents a message starts, in which mode, and every reason not to.
class StartRulesTest {
  private val now = 50_000_000L
  private val ok = StartRules.Look(
    speaksAcp = true, wakesByServer = false, levelWakes = true, installing = false, checking = false, opening = false, failed = null,
    memoryStopAt = null, now = now,
  )
  private val roomy: () -> String? = { null }

  @Test fun acpKindsStartInAcpModeServerKindsAsUsualAndOthersNever() {
    assertEquals(EngineMode.ACP, StartRules.mode(speaksAcp = true, wakesByServer = false))
    assertEquals(EngineMode.ACP, StartRules.mode(speaksAcp = true, wakesByServer = true))
    assertEquals(EngineMode.TERMINAL, StartRules.mode(speaksAcp = false, wakesByServer = true))
    assertNull(StartRules.mode(speaksAcp = false, wakesByServer = false))
    assertNull(StartRules.refusal(ok, roomy))
    assertNull(StartRules.refusal(ok.copy(speaksAcp = false, wakesByServer = true), roomy))
    assertEquals(StartRules.NEVER, StartRules.refusal(ok.copy(speaksAcp = false), roomy))
  }

  @Test fun everyReasonNotToStart() {
    val refusals = listOf(
      ok.copy(speaksAcp = false),
      ok.copy(levelWakes = false),
      ok.copy(installing = true),
      ok.copy(checking = true),
      ok.copy(opening = true),
      ok.copy(failed = "not ready after 120 s"),
      ok.copy(memoryStopAt = now - 60_000),
    ).map { StartRules.refusal(it, roomy) } + StartRules.refusal(ok) { "the phone is short of memory" }
    assertTrue(refusals.all { it != null })
    assertEquals(refusals.size, refusals.toSet().size)
    assertTrue(StartRules.refusal(ok.copy(failed = "not ready after 120 s"), roomy)!!.endsWith("(not ready after 120 s)"))
  }

  @Test fun aMemoryStopHoldsItBackTenMinutes() {
    assertTrue(StartRules.refusal(ok.copy(memoryStopAt = now - MessageRules.MEMORY_STOP_HOLD_MS + 1), roomy) != null)
    assertNull(StartRules.refusal(ok.copy(memoryStopAt = now - MessageRules.MEMORY_STOP_HOLD_MS), roomy))
  }

  @Test fun theRoomIsReadOnlyWhenAllElseAllows() {
    var asked = 0
    val counting: () -> String? = { asked++; null }
    StartRules.refusal(ok.copy(levelWakes = false), counting)
    StartRules.refusal(ok.copy(installing = true), counting)
    StartRules.refusal(ok.copy(checking = true), counting)
    StartRules.refusal(ok.copy(failed = "x"), counting)
    assertEquals(0, asked)
    StartRules.refusal(ok, counting)
    assertEquals(1, asked)
  }
}
