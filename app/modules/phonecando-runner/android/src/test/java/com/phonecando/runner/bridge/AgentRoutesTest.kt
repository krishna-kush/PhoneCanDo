package com.phonecando.runner.bridge

import com.phonecando.runner.messages.AgentState
import com.phonecando.runner.messages.FakeCourier
import com.phonecando.runner.messages.FakeView
import com.phonecando.runner.messages.Mailbox
import com.phonecando.runner.messages.MessageLog
import com.phonecando.runner.messages.MessageStore
import com.phonecando.runner.messages.ScreenLine
import com.phonecando.runner.messages.tempLog
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// The /agents/* routes through the real router: on every channel, never
// gated, never the screen; the reply shapes the agents_* tools pass on.
class AgentRoutesTest {
  private val file = tempLog()
  private val a1 = agent("a1", "Builder").copy(imageId = "m1")
  private val a2 = agent("a2", "Tester").copy(imageId = "m1")
  private val a3 = agent("a3", "Reviewer").copy(imageId = "m2", wakeable = false)
  private val view = FakeView(a1, a2, a3)
  private val mailbox = Mailbox(MessageLog(MessageStore(file), { 1_000L }), view, FakeCourier(), { 1_000L })
  private val lease = ScreenLease(30_000) { 0L }

  @After fun cleanup() {
    file.parentFile.parentFile.deleteRecursively()
  }

  private fun router(full: Boolean) = BridgeRouter(
    full = full,
    automation = { null },
    lock = com.phonecando.runner.controllock.unlockedLock { 0L }.also { it.lock() },
    lease = lease,
    alive = { true },
    handlers = AgentRoutes(mailbox, view).table(),
  )

  private fun post(path: String, body: JSONObject, from: com.phonecando.runner.agents.AgentRecord = a1, full: Boolean = true): Reply =
    router(full).handle(from, "POST", path, body.toString())

  private fun data(reply: Reply): JSONObject {
    assertEquals(reply.body, 200, reply.status)
    val envelope = JSONObject(reply.body)
    assertTrue(reply.body, envelope.getBoolean("ok"))
    return envelope.getJSONObject("data")
  }

  @Test fun listShowsWhoIsHereByScope() {
    view.set("a2", AgentState.WORKING, chat = "Fix the build")
    view.set("a3", AgentState.STOPPED)
    view.line = ScreenLine("a2", reserved = false, waiting = listOf("a3", "a1"))
    val machine = data(post("/agents/list", JSONObject()))
    assertEquals("machine", machine.getString("scope"))
    assertEquals("Builder", machine.getJSONObject("you").getString("name"))
    assertEquals("yours", machine.getJSONObject("you").getString("machine"))
    val agents = machine.getJSONArray("agents")
    assertEquals(1, agents.length())
    val tester = agents.getJSONObject(0)
    assertEquals("Tester", tester.getString("name"))
    assertEquals("opencode", tester.getString("kind"))
    assertEquals("yours", tester.getString("machine"))
    assertEquals("working", tester.getString("state"))
    assertEquals("Fix the build", tester.getString("chat"))
    assertEquals(listOf("Builder"), (0 until tester.getJSONArray("machineMates").length()).map { tester.getJSONArray("machineMates").getString(it) })
    assertTrue(tester.getBoolean("wakeable"))
    assertTrue(tester.getBoolean("canWake"))
    assertEquals("wakes", tester.getString("messages"))
    assertEquals("wakes", machine.getJSONObject("you").getString("messages"))
    val screen = machine.getJSONObject("screen")
    assertEquals("Tester", screen.getString("holder"))
    assertEquals(2, screen.getInt("yourPlace"))

    val phone = data(post("/agents/list", JSONObject().put("scope", "phone"))).getJSONArray("agents")
    assertEquals(listOf("Tester", "Reviewer"), (0 until phone.length()).map { phone.getJSONObject(it).getString("name") })
    val reviewer = phone.getJSONObject(1)
    assertEquals("other", reviewer.getString("machine"))
    assertEquals("stopped", reviewer.getString("state"))
    assertTrue(reviewer.isNull("chat"))
    assertFalse(reviewer.getBoolean("canWake"))
  }

  @Test fun sendInboxAndWaitWorkLockedAndOnLite() {
    for (full in listOf(true, false)) {
      val sent = data(post("/agents/send", JSONObject().put("to", "Tester").put("text", "full=$full").put("wake", true), full = full))
      assertTrue(sent.getLong("id") > 0)
      val result = sent.getJSONArray("results").getJSONObject(0)
      assertEquals("Tester", result.getString("to"))
      assertEquals("woken", result.getString("status"))
    }
    val inbox = data(post("/agents/inbox", JSONObject().put("limit", 1), from = a2))
    val first = inbox.getJSONArray("messages").getJSONObject(0)
    assertEquals("full=true", first.getString("text"))
    assertEquals("Builder", first.getString("from"))
    assertEquals("opencode", first.getString("kind"))
    assertEquals("yours", first.getString("machine"))
    assertFalse(first.getBoolean("notice"))
    assertTrue(inbox.getBoolean("more"))
    assertTrue(inbox.getString("note").contains("not the user"))
    val waited = data(post("/agents/wait", JSONObject().put("from", "builder").put("timeoutSec", 1), from = a2))
    assertEquals("full=false", waited.getJSONArray("messages").getJSONObject(0).getString("text"))
    assertTrue(data(post("/agents/wait", JSONObject().put("timeoutSec", 0), from = a2)).getBoolean("timeout"))
    // The screen was never taken.
    assertEquals(null, lease.holderId())
  }

  @Test fun aRefusedSendIsItsResult() {
    val sent = data(post("/agents/send", JSONObject().put("to", "nobody").put("text", "hi")))
    assertTrue(sent.isNull("id"))
    assertEquals("refused", sent.getJSONArray("results").getJSONObject(0).getString("status"))
    val unknown = JSONObject(post("/agents/wait", JSONObject().put("from", "nobody"), from = a2).body)
    assertEquals("unknown_agent", unknown.getString("code"))
  }

  @Test fun badArgumentsAre400() {
    for (body in listOf(JSONObject(), JSONObject().put("to", "Tester"), JSONObject().put("to", 3).put("text", "x"))) {
      assertEquals(400, post("/agents/send", body).status)
    }
    assertEquals(400, post("/agents/send", JSONObject().put("to", "Tester").put("text", "x").put("wake", "yes")).status)
    assertEquals(400, post("/agents/inbox", JSONObject().put("limit", "ten")).status)
    assertEquals(400, post("/agents/list", JSONObject().put("scope", 1)).status)
    assertEquals(400, post("/agents/wait", JSONObject().put("timeoutSec", "x")).status)
  }

  @Test fun theRoutesAreOnEveryChannelAndNeverGated() {
    val agents = Route.entries.filter { it.path.startsWith("/agents/") }
    assertEquals(listOf("/agents/list", "/agents/send", "/agents/inbox", "/agents/wait"), agents.map { it.path })
    assertTrue(agents.all { it.method == "POST" && !it.fullOnly && !it.gated && !it.screen && !it.pce })
    assertEquals("agents_send", Route.telemetryKey("/agents/send"))
  }
}
