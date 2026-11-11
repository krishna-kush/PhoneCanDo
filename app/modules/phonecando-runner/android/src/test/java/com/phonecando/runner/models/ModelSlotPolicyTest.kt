package com.phonecando.runner.models

import com.phonecando.runner.models.ModelSlotPolicy.Decision
import com.phonecando.runner.models.ModelSlotPolicy.Wanted
import org.junit.Assert.assertEquals
import org.junit.Test

class ModelSlotPolicyTest {
  @Test fun nothingThereStartsIt() {
    assertEquals(Decision.Start, ModelSlotPolicy.decide(null, 0, null))
  }

  @Test fun theSameModelUpIsShared() {
    assertEquals(Decision.Reuse, ModelSlotPolicy.decide(Wanted(alive = true, ready = true, heldByOthers = true), 0, null))
    assertEquals(Decision.Reuse, ModelSlotPolicy.decide(Wanted(alive = true, ready = true, heldByOthers = false), 0, null))
    // Joining a model that is up never counts against the cap.
    assertEquals(Decision.Reuse, ModelSlotPolicy.decide(Wanted(alive = true, ready = true, heldByOthers = true), 4, 1))
  }

  @Test fun anotherModelLoadedIsNoReasonToRefuse() {
    assertEquals(Decision.Start, ModelSlotPolicy.decide(null, 3, null))
  }

  @Test fun theCapCountsTheOtherModelsUp() {
    assertEquals(Decision.Capped(2), ModelSlotPolicy.decide(null, 2, 2))
    assertEquals(Decision.Capped(1), ModelSlotPolicy.decide(null, 3, 1))
    assertEquals(Decision.Start, ModelSlotPolicy.decide(null, 1, 2))
  }

  @Test fun stillLoadingForAnotherAgentIsRefused() {
    assertEquals(Decision.Loading, ModelSlotPolicy.decide(Wanted(alive = true, ready = false, heldByOthers = true), 0, null))
  }

  @Test fun aDeadOrUnheldServerIsReplaced() {
    assertEquals(Decision.Start, ModelSlotPolicy.decide(Wanted(alive = false, ready = true, heldByOthers = true), 0, null))
    assertEquals(Decision.Start, ModelSlotPolicy.decide(Wanted(alive = true, ready = false, heldByOthers = false), 0, null))
  }
}
