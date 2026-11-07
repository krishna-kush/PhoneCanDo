package com.phonecando.runner.bridge

import com.phonecando.runner.bridge.PromptRegistry.Kind
import com.phonecando.runner.bridge.PromptRegistry.Prompt
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Collections
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

// Prompt registry and the /unlock and /accessibility waits, several agents at
// once. Real threads, short waits.
class PromptFlowsTest {
  private val ids = AtomicInteger()
  private val registry = PromptRegistry { "req-${ids.incrementAndGet()}" }
  private val announced = Collections.synchronizedList(mutableListOf<Prompt>())
  private val withdrawn = Collections.synchronizedList(mutableListOf<String>())
  private val host = object : PromptHost {
    override fun announce(prompt: Prompt): Boolean {
      announced += prompt
      return true
    }

    override fun withdraw(prompt: Prompt) {
      withdrawn += prompt.requestId
    }
  }
  private val flows = PromptFlows(registry, host, sleep = { Thread.sleep(5) })
  private val pool = Executors.newCachedThreadPool()
  private val one = agent("a1", "opencode")
  private val two = agent("a2", "opencode 2")

  @Volatile private var gate = false

  @Volatile private var connected = false

  private fun <T> async(block: () -> T): Future<T> = pool.submit(Callable { block() })

  private fun awaitPending(count: Int): List<Prompt> {
    val deadline = System.currentTimeMillis() + 5_000
    while (registry.pending().size < count) {
      check(System.currentTimeMillis() < deadline) { "only ${registry.pending().size} prompts" }
      Thread.sleep(2)
    }
    return registry.pending()
  }

  private fun awaitEmpty() {
    val deadline = System.currentTimeMillis() + 5_000
    while (registry.pending().isNotEmpty()) {
      check(System.currentTimeMillis() < deadline) { "prompts left: ${registry.pending().size}" }
      Thread.sleep(2)
    }
  }

  @Test fun eachUnlockPromptNamesItsAgent() {
    val first = async { flows.unlock(one, "phone_control", 5_000) { gate } }
    val second = async { flows.unlock(two, "phone_control", 5_000) { gate } }
    val pending = awaitPending(2)
    assertEquals(setOf("opencode", "opencode 2"), pending.map { it.agentName }.toSet())
    val map = pending.first { it.agentId == "a2" }.toMap()
    assertEquals("unlock", map["kind"])
    assertEquals("opencode 2", map["agentName"])
    assertEquals("phone_control", map["reason"])
    assertEquals(setOf("requestId", "kind", "agentId", "agentName", "reason"), map.keys)
    pending.forEach { registry.answerUnlock(it.requestId, false) }
    first.get(5, TimeUnit.SECONDS)
    second.get(5, TimeUnit.SECONDS)
  }

  @Test fun twoUnlocksAreEachResolvedByTheirOwnId() {
    val first = async { flows.unlock(one, "phone_control", 5_000) { gate } }
    val second = async { flows.unlock(two, "phone_control", 5_000) { gate } }
    val pending = awaitPending(2)
    val secondId = pending.first { it.agentId == "a2" }.requestId
    assertTrue(registry.answerUnlock(secondId, false))
    val refused = second.get(5, TimeUnit.SECONDS)
    assertEquals(UnlockOutcome(requested = true, unlocked = false, notified = true), refused)
    // The first is still waiting on its own prompt.
    assertFalse(first.isDone)
    assertEquals(listOf("a1"), registry.pending().map { it.agentId })
    val firstId = pending.first { it.agentId == "a1" }.requestId
    assertTrue(registry.answerUnlock(firstId, true))
    assertTrue(first.get(5, TimeUnit.SECONDS).unlocked)
    awaitEmpty()
    assertEquals(setOf(firstId, secondId), withdrawn.toSet())
  }

  @Test fun theGlobalGateCompletesEveryWaitingUnlock() {
    val first = async { flows.unlock(one, "phone_control", 5_000) { gate } }
    val second = async { flows.unlock(two, "phone_control", 5_000) { gate } }
    val pending = awaitPending(2)
    // The user unlocks from the first agent's dialog: the gate turns on.
    gate = true
    registry.answerUnlock(pending.first { it.agentId == "a1" }.requestId, true)
    assertTrue(first.get(5, TimeUnit.SECONDS).unlocked)
    assertTrue(second.get(5, TimeUnit.SECONDS).unlocked)
    awaitEmpty()
  }

  @Test fun anOpenGateAnswersWithoutAPrompt() {
    gate = true
    val out = flows.unlock(one, "phone_control", 5_000) { gate }
    assertEquals(UnlockOutcome(requested = false, unlocked = true, notified = false), out)
    assertTrue(announced.isEmpty())
  }

  @Test fun aTimeoutRemovesThePrompt() {
    val out = flows.unlock(one, "phone_control", 50) { gate }
    assertEquals(UnlockOutcome(requested = true, unlocked = false, notified = true), out)
    assertTrue(registry.pending().isEmpty())
    assertEquals(listOf(announced.single().requestId), withdrawn)
    // A late answer finds nothing.
    assertFalse(registry.answerUnlock(announced.single().requestId, true))
  }

  @Test fun notNowCancelsOnlyItsOwnAccessibilityRequest() {
    val first = async { flows.accessibility(one, "accessibility", 5_000) { connected } }
    val second = async { flows.accessibility(two, "accessibility", 5_000) { connected } }
    val pending = awaitPending(2)
    val firstId = pending.first { it.agentId == "a1" }.requestId
    assertTrue(registry.progressAccessibility(firstId, false, false))
    val cancelled = first.get(5, TimeUnit.SECONDS)
    assertTrue(cancelled.cancelled)
    assertFalse(cancelled.enabled)
    assertFalse(second.isDone)
    // The second agent's dialog: the user opens the guide, then the switch.
    val secondId = registry.pending().single().requestId
    registry.progressAccessibility(secondId, true, true)
    connected = true
    val enabled = second.get(5, TimeUnit.SECONDS)
    assertEquals(
      AccessibilityOutcome(opened = true, enabled = true, cancelled = false, notified = true, guided = true),
      enabled,
    )
    awaitEmpty()
  }

  @Test fun theServiceConnectingCompletesEveryAccessibilityRequest() {
    val first = async { flows.accessibility(one, "accessibility", 5_000) { connected } }
    val second = async { flows.accessibility(two, "accessibility", 5_000) { connected } }
    awaitPending(2)
    connected = true
    assertTrue(first.get(5, TimeUnit.SECONDS).enabled)
    assertTrue(second.get(5, TimeUnit.SECONDS).enabled)
    awaitEmpty()
  }

  @Test fun answersOnlyReachTheirKind() {
    val unlock = registry.open(Kind.UNLOCK, "a1", "opencode", "phone_control")
    val access = registry.open(Kind.ACCESSIBILITY, "a2", "opencode 2", "accessibility")
    assertFalse(registry.answerUnlock(access.requestId, true))
    assertFalse(registry.progressAccessibility(unlock.requestId, false, false))
    assertEquals(listOf(unlock.requestId, access.requestId), registry.pending().map { it.requestId })
  }

  @Test fun stoppingTheBridgeEndsEveryWait() {
    val first = async { flows.unlock(one, "phone_control", 5_000) { gate } }
    val second = async { flows.accessibility(two, "accessibility", 5_000) { connected } }
    awaitPending(2)
    registry.cancelAll()
    assertFalse(first.get(5, TimeUnit.SECONDS).unlocked)
    assertTrue(second.get(5, TimeUnit.SECONDS).cancelled)
    awaitEmpty()
  }
}
