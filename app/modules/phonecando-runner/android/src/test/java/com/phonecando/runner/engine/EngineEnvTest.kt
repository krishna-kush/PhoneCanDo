package com.phonecando.runner.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

// JVM checks for the engine environment's layers and the agent tag.
class EngineEnvTest {
  private val base = mapOf("PATH" to "/system/bin", "HOME" to "/data/app-home", "PHONECANDO_BRIDGE_TOKEN" to "stale")

  @Test fun layersInOrderWithTheTagLast() {
    val env = EngineEnv.build(
      base = base + ("PHONECANDO_AGENT" to "other"),
      image = mapOf("HOME" to "/img/home", "PATH" to "/img/shims:/system/bin", "PHONECANDO_AGENT" to "spoof"),
      kind = mapOf("OPENCODE_SERVER_PASSWORD" to "pw", "PATH" to "/kind"),
      bridgeUrl = "http://127.0.0.1:5000",
      bridgeToken = "tok",
      channel = "lite",
      agentId = "a1",
    )
    assertEquals("/img/home", env["HOME"])
    assertEquals("/kind", env["PATH"])
    assertEquals("pw", env["OPENCODE_SERVER_PASSWORD"])
    assertEquals("http://127.0.0.1:5000", env["PHONECANDO_BRIDGE_URL"])
    assertEquals("tok", env["PHONECANDO_BRIDGE_TOKEN"])
    assertEquals("lite", env["PHONECANDO_CHANNEL"])
    assertEquals("a1", env["PHONECANDO_AGENT"])
  }

  @Test fun noBridgeMeansNoBridgeValues() {
    val env = EngineEnv.build(base, emptyMap(), emptyMap(), null, "tok", "full", "a1")
    assertFalse(env.containsKey("PHONECANDO_BRIDGE_URL"))
    assertFalse(env.containsKey("PHONECANDO_BRIDGE_TOKEN"))
    assertEquals("a1", env["PHONECANDO_AGENT"])
  }
}
