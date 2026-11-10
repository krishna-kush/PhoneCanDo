package com.phonecando.runner.engine

import com.phonecando.agents.kit.manifest.ManifestDecoder
import com.phonecando.runner.agents.TestKinds
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// JVM checks for which engines get the bridge: a kind that names its phone
// tools does, one that names none or says nothing does not, and the env of
// one that does not never holds the token.
class BridgeAccessTest {
  private fun kind(phoneTools: String?) = ManifestDecoder.decode(
    """{"schema":1,"id":"user.top","label":"top","version":"1","type":"image","channels":["full"],"stability":"preview"""" +
      (phoneTools?.let { ""","phoneTools":"$it"""" } ?: "") + "}",
  )

  @Test fun onlyAKindWithPhoneToolsGetsTheBridge() {
    assertTrue(BridgeAccess.granted(kind("plugin")))
    assertTrue(BridgeAccess.granted(kind("mcp:config")))
    assertTrue(BridgeAccess.granted(kind("mcp:argv")))
    assertFalse(BridgeAccess.granted(kind("none")))
    assertFalse(BridgeAccess.granted(kind(null)))
  }

  // Saying nothing means no bridge, so a repo kind says it: none is then a
  // choice, never a field forgotten.
  @Test fun everyRepoKindNamesItsPhoneTools() {
    assertEquals(emptyList<String>(), TestKinds.catalog.all().filter { it.manifest.phoneTools == null }.map { it.id })
  }

  @Test fun anEngineWithoutTheBridgeNeverSeesTheToken() {
    val env = EngineEnv.build(
      base = mapOf("PHONECANDO_BRIDGE_TOKEN" to "inherited"),
      image = emptyMap(),
      kind = mapOf("PHONECANDO_BRIDGE_URL" to "http://x"),
      bridgeUrl = null,
      bridgeToken = "tok",
      channel = "lite",
      agentId = "a1",
    )
    assertFalse(env.containsKey("PHONECANDO_BRIDGE_TOKEN"))
    assertFalse(env.containsKey("PHONECANDO_BRIDGE_URL"))
  }
}
