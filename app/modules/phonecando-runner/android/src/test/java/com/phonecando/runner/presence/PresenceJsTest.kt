package com.phonecando.runner.presence

import com.phonecando.runner.bridge.ScreenLease
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// The frame as JS reads it, the acts by name, and where the user looks.
class PresenceJsTest {
  @Test fun theMapShape() {
    val frame = PresenceFrame(
      ScreenLease.Seat("a1", "opencode"),
      HandOver("a1", "opencode", HandMode.PAUSED, HandBy.AGENT, "password", 9),
      mapOf("a2" to AgentStatus("Testing", StatusMood.THINKING, 3)),
    )
    assertEquals(
      mapOf(
        "driver" to mapOf("agentId" to "a1", "name" to "opencode"),
        "handOver" to mapOf("agentId" to "a1", "agentName" to "opencode", "mode" to "paused", "by" to "agent", "why" to "password"),
        "statuses" to mapOf("a2" to mapOf("text" to "Testing", "mood" to "thinking")),
      ),
      PresenceJs.of(frame),
    )
    assertEquals(mapOf("driver" to null, "handOver" to null, "statuses" to emptyMap<String, Any>()), PresenceJs.of(PresenceFrame.EMPTY))
  }

  @Test fun actsByName() {
    assertEquals(UserAct.START_AGAIN, PresenceJs.act("START_AGAIN"))
    assertEquals(UserAct.LET_ME, PresenceJs.act("let_me"))
    assertNull(PresenceJs.act("TAKE_BACK"))
  }

  @Test fun focus() {
    val front = Focus.Facts(appShown = true, openAgent = "a1", interactive = true, locked = false)
    assertEquals(Focus.Seen("front", "your_chat", "unlocked"), Focus.of(front, "a1"))
    assertEquals(Focus.Seen("front", "other_agent", "unlocked"), Focus.of(front, "a2"))
    assertEquals(Focus.Seen("front", "app", "unlocked"), Focus.of(front.copy(openAgent = null), "a1"))
    assertEquals(Focus.Seen("back", null, "locked"), Focus.of(front.copy(appShown = false, locked = true), "a1"))
    assertEquals(Focus.Seen("back", null, "off"), Focus.of(front.copy(appShown = false, interactive = false, locked = true), "a1"))
  }
}
