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

  @Test fun mapIsWhatJsReads() {
    assertEquals(mapOf("tab" to "env", "agentId" to null), LaunchTarget("env", null).toMap())
  }
}
