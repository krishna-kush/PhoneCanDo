package com.phonecando.runner.prompts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// JVM checks for the open_url prompts: only links we open, no repeats while
// one waits, a few per agent, and they end with the user or the engine.
class OpenUrlRegistryTest {
  private var next = 0
  private val registry = OpenUrlRegistry { "r${next++}" }

  @Test fun aLinkBecomesAPrompt() {
    val opened = registry.open("a1", "Gemini", "https://github.com/login/device")!!
    assertNull(opened.pushedOut)
    assertEquals(
      mapOf(
        "requestId" to "r0",
        "kind" to "open_url",
        "agentId" to "a1",
        "agentName" to "Gemini",
        "reason" to "open_url",
        "url" to "https://github.com/login/device",
      ),
      opened.prompt.toMap(),
    )
    assertEquals("github.com", opened.prompt.host)
    assertEquals(listOf("r0"), registry.pending().map { it.requestId })
  }

  @Test fun refusedAndRepeatedLinksAddNothing() {
    assertNull(registry.open("a1", "A", "file:///etc/passwd"))
    registry.open("a1", "A", "https://x.example/1")!!
    assertNull(registry.open("a1", "A", "https://x.example/1"))
    // Another agent may ask for the same link.
    registry.open("a2", "B", "https://x.example/1")!!
    assertEquals(listOf("a1", "a2"), registry.pending().map { it.agentId })
  }

  @Test fun aNewLinkPushesOutTheAgentsOldest() {
    repeat(OpenUrlRegistry.MAX_PER_AGENT) { registry.open("a1", "A", "https://x.example/$it")!! }
    registry.open("a2", "B", "https://y.example/")!!
    val opened = registry.open("a1", "A", "https://x.example/new")!!
    assertEquals("https://x.example/0", opened.pushedOut?.url)
    assertEquals(OpenUrlRegistry.MAX_PER_AGENT, registry.pending().count { it.agentId == "a1" })
    assertEquals(1, registry.pending().count { it.agentId == "a2" })
  }

  @Test fun theUserOrTheEngineEndsThem() {
    val first = registry.open("a1", "A", "https://x.example/1")!!.prompt
    registry.open("a1", "A", "https://x.example/2")!!
    registry.open("a2", "B", "https://y.example/")!!
    assertEquals(first, registry.resolve(first.requestId))
    assertNull(registry.resolve(first.requestId))
    assertEquals(listOf("https://x.example/2"), registry.drop("a1").map { it.url })
    assertEquals(listOf("a2"), registry.pending().map { it.agentId })
  }
}
