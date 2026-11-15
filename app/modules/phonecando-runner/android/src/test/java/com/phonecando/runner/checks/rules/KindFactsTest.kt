package com.phonecando.runner.checks.rules

import com.phonecando.agents.kit.Capability
import com.phonecando.agents.kit.manifest.InboxWake
import com.phonecando.agents.kit.render.KindCapabilities
import com.phonecando.runner.agents.TestKinds
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// What the rules read of the repo's kinds: one of each way in (MCP tools
// and hooks, a plugin with a reader, a server).
class KindFactsTest {
  private fun facts(id: String): KindFacts {
    val kind = checkNotNull(TestKinds.catalog.get(id)) { "no kind $id" }
    return KindFacts.of(kind, KindCapabilities.declared(kind))
  }

  @Test fun claudeCodeReachesUsByMcpAndHooks() {
    val f = facts("claude-code")
    assertTrue(f.toolsByMcp)
    assertTrue(f.acpToolsExpected)
    assertTrue("Stop" in f.hookEvents)
    assertEquals(InboxWake.HOOK, f.wake)
    assertFalse(f.server)
  }

  @Test fun piHasAPluginAndAReader() {
    val f = facts("pi")
    assertFalse(f.toolsByMcp)
    // Its ACP tools come from its own config and plugin: no contact expected.
    assertFalse(f.acpToolsExpected)
    assertEquals(emptyList<String>(), f.hookEvents)
    assertEquals(InboxWake.READER, f.wake)
  }

  @Test fun opencodeTakesMessagesByItsServer() {
    val f = facts("opencode")
    assertFalse(f.toolsByMcp)
    assertTrue(f.server)
    assertTrue(Capability.MESSAGES in f.declared)
  }
}
