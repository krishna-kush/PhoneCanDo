package com.phonecando.runner.engine.acp

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// JVM checks for what an initialize answer says: the Claude adapter's from
// our PC trial, one that offers little, and odd shapes.
class AcpCapsTest {
  @Test fun theClaudeAdaptersAnswer() {
    val caps = AcpCaps.of(
      JSONObject(
        """{"protocolVersion":1,"agentCapabilities":{"promptCapabilities":{"image":true,"embeddedContext":true},
          "mcpCapabilities":{"http":true,"sse":true},"loadSession":true,
          "sessionCapabilities":{"list":{},"resume":{},"close":{}}},
          "agentInfo":{"name":"@agentclientprotocol/claude-agent-acp","title":"Claude Agent","version":"0.106.0"},
          "authMethods":[{"id":"claude-ai-login","name":"Claude Subscription","type":"terminal"},{"id":"key","name":"Key"}]}""",
      ),
    )
    assertTrue(caps.loadSession)
    assertTrue(caps.resume)
    assertTrue(caps.list)
    assertTrue(caps.mcpHttp)
    assertTrue(caps.image)
    assertEquals(listOf(AcpCaps.AuthMethod("claude-ai-login", "terminal"), AcpCaps.AuthMethod("key", "agent")), caps.authMethods)
    assertEquals("@agentclientprotocol/claude-agent-acp", caps.agentName)
    assertEquals("0.106.0", caps.agentVersion)
  }

  @Test fun anAgentThatOffersLittle() {
    val caps = AcpCaps.of(JSONObject("""{"protocolVersion":1,"agentCapabilities":{"loadSession":true,"mcpCapabilities":{"http":false}}}"""))
    assertTrue(caps.loadSession)
    assertFalse(caps.resume)
    assertFalse(caps.list)
    assertFalse(caps.mcpHttp)
    assertTrue(caps.authMethods.isEmpty())
    assertNull(caps.agentName)
  }

  @Test fun oddShapesReadAsWhatTheySay() {
    val caps = AcpCaps.of(JSONObject("""{"agentCapabilities":{"sessionCapabilities":{"list":true,"resume":false},"mcpCapabilities":null}}"""))
    assertTrue(caps.list)
    assertFalse(caps.resume)
    assertFalse(caps.mcpHttp)
    assertEquals(AcpCaps(), AcpCaps.of(JSONObject("{}")))
  }
}
