package com.phonecando.runner.bridge

import com.phonecando.runner.engine.work.KeepAsks
import com.phonecando.runner.engine.work.WorkRules
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// /keep through the real router: on every channel, never gated, never the
// screen; an ask's length, its reason, taking it back, and bad arguments.
class KeepRoutesTest {
  private val now = 1_000_000L
  private val asks = KeepAsks { now }
  private val kept = HashSet<String>()
  private var changes = 0
  private val a1 = agent("a1", "Builder")

  private fun router(full: Boolean) = BridgeRouter(
    full = full,
    automation = { null },
    lock = com.phonecando.runner.controllock.unlockedLock { 0L }.also { it.lock() },
    lease = ScreenLease(30_000) { 0L },
    alive = { true },
    handlers = KeepRoutes(asks, { it in kept }) { changes++ }.table(),
  )

  private fun post(body: JSONObject, full: Boolean = true): Reply = router(full).handle(a1, "POST", "/keep", body.toString())

  private fun data(reply: Reply): JSONObject {
    assertEquals(reply.body, 200, reply.status)
    return JSONObject(reply.body).getJSONObject("data")
  }

  @Test fun anAgentAsksToStayUpOnEveryChannelWithPhoneControlLocked() {
    for (full in listOf(true, false)) {
      val reply = data(post(JSONObject().put("on", true).put("reason", "waiting for Tester's answer"), full))
      assertTrue(reply.getBoolean("on"))
      assertEquals("waiting for Tester's answer", reply.getString("reason"))
      assertEquals(WorkRules.ASK_DEFAULT_MINUTES, reply.getInt("minutes"))
      assertEquals("1970-01-01T00:46:40Z", reply.getString("until"))
      assertFalse(reply.getBoolean("userKeepsRunning"))
    }
    assertEquals(now + WorkRules.ASK_DEFAULT_MINUTES * 60_000L, asks.get("a1")?.until)
    assertEquals(2, changes)
  }

  @Test fun minutesAreCutToTheLimits() {
    assertEquals(WorkRules.ASK_MAX_MINUTES, data(post(JSONObject().put("on", true).put("reason", "ci").put("minutes", 999))).getInt("minutes"))
    assertEquals(1, data(post(JSONObject().put("on", true).put("reason", "ci").put("minutes", 0))).getInt("minutes"))
    assertEquals(45, data(post(JSONObject().put("on", true).put("reason", "ci").put("minutes", 45.7))).getInt("minutes"))
  }

  @Test fun offTakesTheAskBackAndSaysWhetherTheUserKeepsItRunning() {
    post(JSONObject().put("on", true).put("reason", "ci"))
    kept += "a1"
    val off = data(post(JSONObject().put("on", false)))
    assertFalse(off.getBoolean("on"))
    assertTrue(off.getBoolean("userKeepsRunning"))
    assertNull(asks.get("a1"))
  }

  @Test fun badArgumentsAreRefused() {
    for (body in listOf(
      JSONObject(),
      JSONObject().put("on", "yes"),
      JSONObject().put("on", true),
      JSONObject().put("on", true).put("reason", "  "),
      JSONObject().put("on", true).put("reason", 5),
      JSONObject().put("on", true).put("reason", "ci").put("minutes", "ten"),
    )) {
      val reply = post(body)
      assertEquals(reply.body, 400, reply.status)
      assertEquals("bad_request", JSONObject(reply.body).getString("code"))
    }
    assertNull(asks.get("a1"))
    assertEquals(0, changes)
  }
}
