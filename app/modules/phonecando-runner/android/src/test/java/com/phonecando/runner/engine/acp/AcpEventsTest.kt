package com.phonecando.runner.engine.acp

import com.phonecando.agents.kit.EngineEvent
import com.phonecando.runner.engine.tui.TuiEvents
import org.junit.Assert.assertEquals
import org.junit.Test

// JVM checks for an ACP turn's course as engine events, on the one chat a
// TUI has, so Home and the notification read both modes alike.
class AcpEventsTest {
  @Test fun aTurnWorksWaitsAndWorksAgain() {
    assertEquals(EngineEvent(EngineEvent.Kind.WORKING, TuiEvents.SESSION), AcpEvents.promptSent())
    assertEquals(EngineEvent(EngineEvent.Kind.WAITING, TuiEvents.SESSION), AcpEvents.asked())
    assertEquals(EngineEvent(EngineEvent.Kind.WORKING, TuiEvents.SESSION), AcpEvents.answered())
  }

  @Test fun itsEndFollowsTheStopReason() {
    assertEquals(EngineEvent.Kind.FINISHED, AcpEvents.kindOf("end_turn", null))
    assertEquals(EngineEvent.Kind.STOPPED, AcpEvents.kindOf("cancelled", null))
    for (reason in listOf("refusal", "max_tokens", "max_turn_requests")) {
      assertEquals(reason, EngineEvent.Kind.FAILED, AcpEvents.kindOf(reason, null))
    }
    assertEquals(EngineEvent.Kind.FAILED, AcpEvents.kindOf(null, "the agent is not running"))
    assertEquals(EngineEvent.Kind.FAILED, AcpEvents.kindOf("end_turn", "late error"))
    // A reason we do not know ended the turn without saying it failed.
    assertEquals(EngineEvent.Kind.FINISHED, AcpEvents.kindOf("paused", null))
    assertEquals(EngineEvent.Kind.FINISHED, AcpEvents.kindOf(null, null))
    assertEquals(EngineEvent(EngineEvent.Kind.STOPPED, TuiEvents.SESSION), AcpEvents.ended("cancelled", null))
  }

  @Test fun aTitleIsAnOtherEvent() {
    assertEquals(EngineEvent(EngineEvent.Kind.OTHER, TuiEvents.SESSION, title = "Nightly build"), AcpEvents.title("Nightly build"))
  }
}
