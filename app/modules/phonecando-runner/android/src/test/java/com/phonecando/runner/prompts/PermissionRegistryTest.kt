package com.phonecando.runner.prompts

import com.phonecando.runner.prompts.PermissionRegistry.Option
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

// JVM checks for the permission prompts: what the app sees, which answers
// Allow and Deny send, which answers count, and how they end.
class PermissionRegistryTest {
  private val registry = PermissionRegistry()
  private val options = listOf(
    Option("always", "Always allow", "allow_always"),
    Option("once", "Allow", "allow_once"),
    Option("no", "Reject", "reject_once"),
  )

  @Test fun aQuestionBecomesAPrompt() {
    val p = registry.open("p1", "a1", "Qwen", "Run ls -la", "execute", options).prompt
    assertEquals(
      mapOf(
        "requestId" to "p1",
        "kind" to "permission",
        "agentId" to "a1",
        "agentName" to "Qwen",
        "reason" to "permission",
        "title" to "Run ls -la",
        "toolKind" to "execute",
        "options" to listOf(
          mapOf("optionId" to "always", "name" to "Always allow", "kind" to "allow_always"),
          mapOf("optionId" to "once", "name" to "Allow", "kind" to "allow_once"),
          mapOf("optionId" to "no", "name" to "Reject", "kind" to "reject_once"),
        ),
      ),
      p.toMap(),
    )
    assertEquals(listOf("p1"), registry.pending().map { it.requestId })
  }

  @Test fun allowPicksAllowOnceFirstAndDenyARejectOrNothing() {
    val p = registry.open("p1", "a1", "Qwen", "Edit", null, options).prompt
    assertEquals("once", p.allow?.optionId)
    assertEquals("no", p.deny?.optionId)
    val only = registry.open("p2", "a1", "Qwen", "Edit", null, listOf(Option("al", "Always", "allow_always"))).prompt
    assertEquals("al", only.allow?.optionId)
    assertNull(only.deny)
    assertTrue(only.accepts("al"))
    assertTrue(only.accepts(null))
    assertFalse(only.accepts("made-up"))
  }

  @Test fun theSameQuestionAgainReplacesItAndTakesANewSlot() {
    val first = registry.open("p1", "a1", "Qwen", "Read a", null, options).prompt
    val again = registry.open("p1", "a1", "Qwen", "Read a", null, options)
    assertSame(first, again.replaced)
    assertEquals(first.seq + 1, again.prompt.seq)
    assertEquals(1, registry.pending().size)
  }

  @Test fun theyGoWhenAnsweredTakenBackOrTheTurnEnds() {
    registry.open("p1", "a1", "Qwen", "Read a", null, options)
    registry.open("p2", "a1", "Qwen", "Read b", null, options)
    registry.open("p3", "a2", "Kimi", "Read c", null, options)
    assertEquals("Read a", registry.remove("p1")?.title)
    assertNull(registry.remove("p1"))
    assertNull(registry.get("p1"))
    assertEquals(listOf("p2"), registry.drop("a1").map { it.requestId })
    assertEquals(listOf("p3"), registry.pending().map { it.requestId })
  }
}
