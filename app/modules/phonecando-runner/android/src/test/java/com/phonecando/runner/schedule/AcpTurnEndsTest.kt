package com.phonecando.runner.schedule

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// How an ACP turn a task began reads in its run.
class AcpTurnEndsTest {
  @Test fun aTurnThatEndsWellOrIsStoppedLeavesTheRun() {
    assertNull(AcpTurnEnds.failure("end_turn", null))
    assertNull(AcpTurnEnds.failure("cancelled", null))
    assertNull(AcpTurnEnds.failure(null, null))
  }

  @Test fun anErrorARefusalOrALimitFailsIt() {
    assertEquals("the agent's turn ended with an error: Authentication required", AcpTurnEnds.failure(null, " Authentication required "))
    assertEquals("the agent's turn ended with an error: no detail", AcpTurnEnds.failure("end_turn", ""))
    assertEquals("the agent refused the task", AcpTurnEnds.failure("refusal", null))
    assertEquals("the agent's turn hit its token limit", AcpTurnEnds.failure("max_tokens", null))
    assertEquals("the agent's turn hit its limit of model requests", AcpTurnEnds.failure("max_turn_requests", null))
    assertEquals(200 + "the agent's turn ended with an error: ".length, AcpTurnEnds.failure(null, "x".repeat(500))!!.length)
  }
}
