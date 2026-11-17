package com.phonecando.runner.notify

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class LaunchTargetTest {
  @Test fun unknownTabIsHomeAndBlankAgentIsNone() {
    assertEquals(LaunchTarget("home", null), LaunchTarget.of(null, ""))
    assertEquals(LaunchTarget("home", "a1"), LaunchTarget.of("chat", "a1"))
    assertEquals(LaunchTarget("settings", null), LaunchTarget.of("settings", " "))
  }

  @Test fun eachAgentAndTabHasItsOwnKey() {
    assertNotEquals(LaunchTarget("home", "a1").key, LaunchTarget("home", "a2").key)
    assertNotEquals(LaunchTarget("home", "a1").key, LaunchTarget("env", "a1").key)
    assertEquals(LaunchTarget("home", "a1").key, LaunchTarget.of("home", "a1").key)
  }

  @Test fun checksLandsOnTheAgentsChecks() {
    assertEquals(LaunchTarget("checks", "a1"), LaunchTarget.of("checks", "a1"))
    assertEquals(LaunchTarget.CHECKS, LaunchTarget.of(LaunchTarget.CHECKS, "a1").tab)
    assertNotEquals(LaunchTarget("checks", "a1").key, LaunchTarget("home", "a1").key)
  }

  @Test fun theAppWidePlacesNeedNoAgent() {
    for (tab in listOf(LaunchTarget.MODELS, LaunchTarget.UPDATES, LaunchTarget.MEMORY)) {
      assertEquals(LaunchTarget(tab, null), LaunchTarget.of(tab, null))
    }
  }

  @Test fun mapIsWhatJsReads() {
    assertEquals(mapOf("tab" to "env", "agentId" to null, "chatId" to null), LaunchTarget("env", null).toMap())
    assertEquals(mapOf("tab" to "home", "agentId" to "a1", "chatId" to "ses_1"), LaunchTarget("home", "a1", "ses_1").toMap())
  }

  @Test fun eachChatHasItsOwnKey() {
    assertEquals(LaunchTarget("home", "a1", "ses_1"), LaunchTarget.of("home", "a1", "ses_1"))
    assertNotEquals(LaunchTarget("home", "a1", "ses_1").key, LaunchTarget("home", "a1", "ses_2").key)
    assertNotEquals(LaunchTarget("home", "a1", "ses_1").key, LaunchTarget("home", "a1").key)
    // A target without a chat keeps the key it always had.
    assertEquals("a1/home", LaunchTarget("home", "a1").key)
    // A blank chat is none, and so is a chat with no agent.
    assertEquals(LaunchTarget("home", "a1"), LaunchTarget.of("home", "a1", " "))
    assertEquals(LaunchTarget("home", null), LaunchTarget.of("home", "", "ses_1"))
  }
}
