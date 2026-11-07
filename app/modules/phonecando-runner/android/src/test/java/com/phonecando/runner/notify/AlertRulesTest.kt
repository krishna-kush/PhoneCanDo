package com.phonecando.runner.notify

import com.phonecando.runner.agents.EngineEvent
import com.phonecando.runner.agents.EngineEvent.Kind
import com.phonecando.runner.notify.AlertRules.Alert
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// Which engine events become an agent alert, for several agents at once.
class AlertRulesTest {
  private val rules = AlertRules(maxChildren = 2)
  private var inFront = false
  private var frontAsked = 0

  private fun on(agent: String, kind: Kind, session: String?, child: Boolean = false): Alert? =
    rules.onEvent(agent, EngineEvent(kind, session, childCreated = child)) {
      frontAsked++
      inFront
    }

  private fun childCreated(agent: String, session: String) = on(agent, Kind.OTHER, session, child = true)

  @Test fun verdictsAndWaitsAlert() {
    assertEquals(Alert.FINISHED, on("a", Kind.FINISHED, "s1"))
    assertEquals(Alert.FAILED, on("a", Kind.FAILED, "s2"))
    assertEquals(Alert.WAITING, on("a", Kind.WAITING, "s3"))
  }

  @Test fun activityAndOtherNeverAlert() {
    assertNull(on("a", Kind.WORKING, "s1"))
    assertNull(on("a", Kind.OTHER, "s1"))
    assertNull(on("a", Kind.GONE, "s1"))
    assertEquals(0, frontAsked)
  }

  @Test fun noSessionNoAlert() {
    assertNull(on("a", Kind.FAILED, null))
    assertNull(on("a", Kind.WAITING, null))
  }

  @Test fun childVerdictsStayQuietButTheirWaitsAlert() {
    childCreated("a", "child")
    assertNull(on("a", Kind.FINISHED, "child"))
    assertNull(on("a", Kind.FAILED, "child"))
    assertEquals(Alert.WAITING, on("a", Kind.WAITING, "child"))
    // Another agent's session with the same id is its own.
    assertEquals(Alert.FINISHED, on("b", Kind.FINISHED, "child"))
  }

  @Test fun theSameAlertComesOnceUntilTheSessionMoves() {
    assertEquals(Alert.FINISHED, on("a", Kind.FINISHED, "s1"))
    assertNull(on("a", Kind.FINISHED, "s1"))
    assertNull(on("a", Kind.WORKING, "s2"))
    assertNull(on("a", Kind.FINISHED, "s1"))
    on("a", Kind.WORKING, "s1")
    assertEquals(Alert.FINISHED, on("a", Kind.FINISHED, "s1"))
    // A different verdict or session is a new alert.
    assertEquals(Alert.FAILED, on("a", Kind.FAILED, "s1"))
    assertEquals(Alert.FAILED, on("a", Kind.FAILED, "s9"))
  }

  @Test fun aWaitAnsweredCanAlertAgain() {
    assertEquals(Alert.WAITING, on("a", Kind.WAITING, "s1"))
    assertNull(on("a", Kind.WAITING, "s1"))
    on("a", Kind.WORKING, "s1") // permission.replied
    assertEquals(Alert.WAITING, on("a", Kind.WAITING, "s1"))
  }

  @Test fun inFrontNothingPostsAndTheAlertCountsAsGiven() {
    inFront = true
    assertNull(on("a", Kind.FINISHED, "s1"))
    assertEquals(1, frontAsked)
    inFront = false
    assertNull(on("a", Kind.FINISHED, "s1"))
    assertEquals(Alert.WAITING, on("a", Kind.WAITING, "s1"))
  }

  @Test fun resetForgetsChildrenAndTheLastAlert() {
    childCreated("a", "child")
    assertEquals(Alert.FINISHED, on("a", Kind.FINISHED, "s1"))
    rules.reset("a")
    assertEquals(Alert.FINISHED, on("a", Kind.FINISHED, "s1"))
    assertEquals(Alert.FINISHED, on("a", Kind.FINISHED, "child"))
  }

  @Test fun childrenAreBoundedOldestFirst() {
    childCreated("a", "c1")
    childCreated("a", "c2")
    childCreated("a", "c3")
    assertEquals(Alert.FINISHED, on("a", Kind.FINISHED, "c1"))
    assertNull(on("a", Kind.FINISHED, "c2"))
    assertNull(on("a", Kind.FINISHED, "c3"))
  }

  @Test fun aDeletedChildIsForgotten() {
    childCreated("a", "c1")
    on("a", Kind.GONE, "c1")
    assertEquals(Alert.FINISHED, on("a", Kind.FINISHED, "c1"))
  }
}
