package com.phonecando.runner.bridge

import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.appaccess.FakeAppAccessStore
import com.phonecando.runner.appaccess.appAccess
import com.phonecando.runner.bridge.PromptRegistry.Kind
import com.phonecando.runner.bridge.PromptRegistry.Prompt
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Collections
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit

// The app question behind /app-access: the prompt the app sees, its
// answers (applied, then recorded: BridgePrompts.resolveApp) and the wait.
// On the process's registry, as resolveApp answers there. Real threads,
// short waits.
class AppPromptTest {
  private val bank = "com.example.bank"
  private val registry = BridgePrompts.registry
  private val store = FakeAppAccessStore()
  private val access = appAccess(store)
  private val announced = Collections.synchronizedList(mutableListOf<Prompt>())
  private val host = object : PromptHost {
    override fun announce(prompt: Prompt): Boolean {
      announced += prompt
      return true
    }

    override fun withdraw(prompt: Prompt) = Unit
  }
  private val flows = PromptFlows(registry, host, sleep = { Thread.sleep(5) })
  private val pool = Executors.newCachedThreadPool()
  private val one = agent("a1", "opencode")
  private val two = agent("a2", "claude")

  @After fun nothingLeft() {
    registry.cancelAll()
    pool.shutdown()
  }

  private fun ask(who: AgentRecord = one, waitMs: Long = 5_000): Future<AppOutcome> =
    pool.submit(Callable { flows.app(who, bank, access.label(bank), waitMs) { access.verdict(bank, who.id) } })

  private fun awaitPending(count: Int): List<Prompt> {
    val deadline = System.currentTimeMillis() + 5_000
    while (registry.pending().size < count) {
      check(System.currentTimeMillis() < deadline) { "only ${registry.pending().size} prompts" }
      Thread.sleep(2)
    }
    return registry.pending()
  }

  @Test fun thePromptNamesTheApp() {
    val waiting = ask()
    val map = awaitPending(1).single().toMap()
    assertEquals(
      mapOf(
        "requestId" to map["requestId"],
        "kind" to "app",
        "agentId" to "a1",
        "agentName" to "opencode",
        "reason" to "app_access",
        "package" to bank,
        "label" to "Name of $bank",
      ),
      map,
    )
    BridgePrompts.resolveApp(access, map["requestId"] as String, "no")
    waiting.get(5, TimeUnit.SECONDS)
  }

  @Test fun alwaysAnswersAndSaves() {
    val waiting = ask()
    val id = awaitPending(1).single().requestId
    assertTrue(BridgePrompts.resolveApp(access, id, "always"))
    assertEquals(
      AppOutcome(asked = true, allowed = true, blocked = false, answer = "always", notified = true),
      waiting.get(5, TimeUnit.SECONDS),
    )
    assertEquals(setOf(bank), store.always)
    assertTrue(registry.pending().isEmpty())
  }

  @Test fun alwaysWithoutTheBiometricLeavesThePromptWaiting() {
    store.authed = false
    val waiting = ask()
    val id = awaitPending(1).single().requestId
    assertFalse(BridgePrompts.resolveApp(access, id, "always"))
    assertFalse(waiting.isDone)
    assertNull(registry.pending().single().appAnswer)
    // The user picks Just now instead.
    assertTrue(BridgePrompts.resolveApp(access, id, "once"))
    val out = waiting.get(5, TimeUnit.SECONDS)
    assertEquals(AppOutcome(asked = true, allowed = true, blocked = false, answer = "once", notified = true), out)
    assertTrue(store.always.isEmpty())
  }

  @Test fun justNowIsOnlyTheAskingAgents() {
    val first = ask(one)
    awaitPending(1)
    val second = ask(two)
    val pending = awaitPending(2)
    assertTrue(BridgePrompts.resolveApp(access, pending.first { it.agentId == "a1" }.requestId, "once"))
    assertTrue(first.get(5, TimeUnit.SECONDS).allowed)
    // The other agent still waits on its own question.
    assertFalse(second.isDone)
    assertEquals(listOf("a2"), registry.pending().map { it.agentId })
    assertTrue(BridgePrompts.resolveApp(access, registry.pending().single().requestId, "no"))
    assertEquals(
      AppOutcome(asked = true, allowed = false, blocked = true, answer = "no", notified = true),
      second.get(5, TimeUnit.SECONDS),
    )
  }

  @Test fun anotherPromptsAnswerEndsTheWait() {
    val first = ask(one)
    awaitPending(1)
    val second = ask(two)
    val pending = awaitPending(2)
    BridgePrompts.resolveApp(access, pending.first { it.agentId == "a1" }.requestId, "always")
    assertEquals(
      AppOutcome(asked = true, allowed = true, blocked = false, answer = null, notified = true),
      second.get(5, TimeUnit.SECONDS),
    )
    assertEquals("always", first.get(5, TimeUnit.SECONDS).answer)
  }

  @Test fun aTimeoutAnswersNothing() {
    val out = ask(waitMs = 50).get(5, TimeUnit.SECONDS)
    assertEquals(AppOutcome(asked = true, allowed = false, blocked = false, answer = null, notified = true), out)
    assertTrue(registry.pending().isEmpty())
    // A late answer finds nothing and changes nothing.
    assertFalse(BridgePrompts.resolveApp(access, announced.single().requestId, "always"))
    assertTrue(store.always.isEmpty())
  }

  @Test fun anAllowedOrBlockedAppAsksNothing() {
    access.grantOnce("a1", bank)
    assertEquals(AppOutcome(asked = false, allowed = true, blocked = false, answer = null, notified = false), ask().get(5, TimeUnit.SECONDS))
    access.block(bank)
    assertEquals(AppOutcome(asked = false, allowed = false, blocked = true, answer = null, notified = false), ask().get(5, TimeUnit.SECONDS))
    assertTrue(announced.isEmpty())
  }

  @Test fun stoppingTheBridgeEndsTheWait() {
    val waiting = ask()
    awaitPending(1)
    registry.cancelAll()
    assertFalse(waiting.get(5, TimeUnit.SECONDS).allowed)
  }

  @Test fun answersOnlyReachAppPromptsAndKnownAnswers() {
    val unlock = registry.open(Kind.UNLOCK, "a1", "opencode", "phone_control")
    val app = registry.open(Kind.APP, "a2", "claude", "app_access", bank, "Bank")
    try {
      assertFalse(registry.answerApp(unlock.requestId, "always"))
      assertFalse(registry.answerUnlock(app.requestId, true))
      assertFalse(registry.answerApp(app.requestId, "sure"))
      assertFalse(BridgePrompts.resolveApp(access, app.requestId, "sure"))
      assertTrue(registry.answerApp(app.requestId, "no"))
      // The first answer stands.
      assertTrue(registry.answerApp(app.requestId, "always"))
      assertEquals("no", app.appAnswer)
      assertEquals(setOf("requestId", "kind", "agentId", "agentName", "reason"), unlock.toMap().keys)
    } finally {
      registry.close(unlock)
      registry.close(app)
    }
  }

  // The route: a package is required, as the refusal named it.
  @Test fun theRouteNeedsAPackage() {
    val routes = AppAccessRoutes(flows) { access }.table()
    val handler = routes.getValue(Route.APP_ACCESS)
    val bad = handler(BridgeCall(one, Route.APP_ACCESS, JSONObject().put("package", "Tap Allow")))
    assertEquals(400, bad.status)
    access.grantOnce("a1", bank)
    val ok = JSONObject(handler(BridgeCall(one, Route.APP_ACCESS, JSONObject().put("package", bank))).body).getJSONObject("data")
    assertEquals(setOf("asked", "allowed"), ok.keys().asSequence().toSet())
    assertEquals(false, ok.getBoolean("asked"))
    assertEquals(true, ok.getBoolean("allowed"))
    access.block(bank)
    val no = JSONObject(handler(BridgeCall(one, Route.APP_ACCESS, JSONObject().put("package", bank))).body)
    assertEquals(false, no.getJSONObject("data").getBoolean("allowed"))
    assertEquals(true, no.getJSONObject("data").getBoolean("blocked"))
  }
}
