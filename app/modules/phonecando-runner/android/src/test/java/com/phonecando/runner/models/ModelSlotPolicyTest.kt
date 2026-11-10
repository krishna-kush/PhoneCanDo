package com.phonecando.runner.models

import com.phonecando.runner.models.ModelSlotPolicy.Decision
import org.junit.Assert.assertEquals
import org.junit.Test

class ModelSlotPolicyTest {
  @Test fun nothingThereStartsIt() {
    assertEquals(Decision.Start, ModelSlotPolicy.decide(null, false, false, emptySet(), "qwen"))
  }

  @Test fun theSameModelUpIsShared() {
    assertEquals(Decision.Reuse, ModelSlotPolicy.decide("qwen", true, true, setOf("a"), "qwen"))
    assertEquals(Decision.Reuse, ModelSlotPolicy.decide("qwen", true, true, emptySet(), "qwen"))
  }

  @Test fun anotherModelInUseIsBusy() {
    assertEquals(Decision.Busy("gemma"), ModelSlotPolicy.decide("gemma", true, true, setOf("a"), "qwen"))
    // Still loading for another agent.
    assertEquals(Decision.Busy("qwen"), ModelSlotPolicy.decide("qwen", false, true, setOf("a"), "qwen"))
  }

  @Test fun anUnusedOrDeadServerIsReplaced() {
    assertEquals(Decision.Start, ModelSlotPolicy.decide("gemma", true, true, emptySet(), "qwen"))
    assertEquals(Decision.Start, ModelSlotPolicy.decide("qwen", true, false, setOf("a"), "qwen"))
    assertEquals(Decision.Start, ModelSlotPolicy.decide("gemma", true, false, setOf("a"), "qwen"))
  }
}
