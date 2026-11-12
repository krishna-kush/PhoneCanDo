package com.phonecando.runner.bridge

import com.phonecando.runner.AutomationHost
import com.phonecando.runner.AutomationUnavailableException
import com.phonecando.runner.controllock.LockMode
import com.phonecando.runner.controllock.unlockedLock
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// The router's checks in order (route, flavor, lock, service, body, lease)
// and the envelopes they answer with.
class BridgeRouterTest {
  private class FakeHost : AutomationHost {
    var service = true
    override val connected get() = service

    override fun describe() = JSONObject().put("ok", true)
    override fun observe(options: JSONObject) = JSONObject().put("ok", true).put("snapshotId", 7)
    override fun act(request: JSONObject): JSONObject = throw AutomationUnavailableException("gone")
    override fun pack(request: JSONObject) = JSONObject().put("ok", false).put("code", "NOT_FOUND").put("message", "no pack")
  }

  private var now = 0L
  private val host = FakeHost()
  private val lock = unlockedLock { now }
  private val dir = FakeDirectory(agent("a1", "opencode"), agent("a2", "opencode 2"))
  private val lease = ScreenLease(30_000) { now }
  private val handled = mutableListOf<String>()
  private val echo: RouteHandler = { call ->
    handled += "${call.agent.id} ${call.route.path}"
    Reply.ok(JSONObject().put("route", call.route.path))
  }
  private val handlers: Map<Route, RouteHandler> =
    Route.entries.associateWith { echo } + PceRoutes { host }.table()

  private fun router(full: Boolean = true) =
    BridgeRouter(full, { if (full) host else null }, lock, lease, { dir.get(it) != null }, handlers)

  private fun json(reply: Reply) = JSONObject(reply.body)

  @Test fun liteHasNoFullOnlyRoutes() {
    val lite = router(full = false)
    for (path in listOf("/unlock", "/accessibility", "/pce/act", "/pce/whatever")) {
      val reply = lite.handle(dir.records[0], "POST", path, "{}")
      assertEquals(404, reply.status)
      assertEquals("no route for $path in this build", json(reply).getString("message"))
    }
    // Basic routes need no switch there, and no lease: there is no driver.
    assertEquals(200, lite.handle(dir.records[0], "POST", "/notify", "{}").status)
    assertEquals(200, lite.handle(dir.records[0], "POST", "/open", "{}").status)
    assertEquals(200, lite.handle(dir.records[1], "POST", "/share", "{}").status)
    assertNull(lease.holderId())
  }

  @Test fun unknownRoutesAre404() {
    val reply = router().handle(dir.records[0], "GET", "/ui/screen", "")
    assertEquals(404, reply.status)
    assertEquals("not_found", json(reply).getString("code"))
  }

  @Test fun lockedAndUnavailableComeBeforeTheLease() {
    lock.lock()
    val locked = router().handle(dir.records[0], "POST", "/pce/observe", "{}")
    assertEquals(403, locked.status)
    assertEquals("automation_off", json(locked).getString("code"))
    lock.unlock()
    host.service = false
    val down = router().handle(dir.records[0], "POST", "/pce/observe", "{}")
    assertEquals(503, down.status)
    assertEquals("automation_unavailable", json(down).getString("code"))
    // Neither refusal took the screen.
    assertNull(lease.holderId())
    // Ungated routes still work while locked.
    lock.lock()
    assertEquals(200, router().handle(dir.records[0], "POST", "/app", "{}").status)
  }

  @Test fun badJsonIs400AndTakesNoLease() {
    val reply = router().handle(dir.records[0], "POST", "/pce/observe", "[1,2]")
    assertEquals(400, reply.status)
    assertEquals("bad_json", json(reply).getString("code"))
    assertNull(lease.holderId())
  }

  @Test fun aSecondAgentGetsControlBusy() {
    val r = router()
    val first = r.handle(dir.records[0], "POST", "/pce/observe", "{}")
    assertEquals(7, json(first).getJSONObject("data").getInt("snapshotId"))
    now += 5_000
    val busy = r.handle(dir.records[1], "POST", "/pce/observe", "{}")
    assertEquals(409, busy.status)
    val body = json(busy)
    assertEquals(false, body.getBoolean("ok"))
    assertEquals("control_busy", body.getString("code"))
    assertEquals("opencode", body.getString("holder"))
    assertEquals(25_000, body.getLong("retryAfterMs"))
    assertEquals("the screen is in use by opencode; try again in a moment", body.getString("message"))
    // Calls that leave the screen alone still pass.
    assertEquals(200, r.handle(dir.records[1], "GET", "/ping", "").status)
    assertEquals(200, r.handle(dir.records[1], "POST", "/clipboard", "{}").status)
    assertEquals(200, r.handle(dir.records[1], "GET", "/pce/describe", "").status)
  }

  @Test fun theHoldersReturnHandsTheScreenOver() {
    val r = router()
    r.handle(dir.records[0], "POST", "/open", "{}")
    assertEquals(409, r.handle(dir.records[1], "POST", "/share", "{}").status)
    assertEquals(200, r.handle(dir.records[0], "POST", "/app", "{}").status)
    assertEquals(200, r.handle(dir.records[1], "POST", "/share", "{}").status)
    assertEquals(listOf("a1 /open", "a1 /app", "a2 /share"), handled)
  }

  @Test fun aStoppedHolderFreesTheScreen() {
    val r = router()
    r.handle(dir.records[0], "POST", "/pce/observe", "{}")
    val gone = dir.records.removeAt(0)
    assertEquals(200, r.handle(dir.records[0], "POST", "/pce/observe", "{}").status)
    assertEquals("a2", lease.holderId())
    assertEquals(409, r.handle(gone, "POST", "/pce/observe", "{}").status)
  }

  @Test fun askModeLetsInOnlyTheAgentThatAsked() {
    lock.setMode(LockMode.ASK)
    val r = router()
    assertEquals(403, r.handle(dir.records[0], "POST", "/notify", "{}").status)
    lock.grantAsk("a1")
    assertEquals(200, r.handle(dir.records[0], "POST", "/notify", "{}").status)
    assertEquals(403, r.handle(dir.records[1], "POST", "/notify", "{}").status)
    // Handing the phone back ends the unlock with the task.
    assertEquals(200, r.handle(dir.records[0], "POST", "/app", "{}").status)
    assertEquals(403, r.handle(dir.records[0], "POST", "/notify", "{}").status)
  }

  @Test fun anAskUnlockLastsWhileItIsUsed() {
    lock.setMode(LockMode.ASK)
    lock.grantAsk("a1")
    val r = router()
    now += 240_000
    assertEquals(200, r.handle(dir.records[0], "POST", "/clipboard", "{}").status)
    now += 240_000
    assertEquals(200, r.handle(dir.records[0], "POST", "/clipboard", "{}").status)
    now += 300_000
    assertEquals(403, r.handle(dir.records[0], "POST", "/clipboard", "{}").status)
  }

  @Test fun pceFailuresKeepTheirEnvelopes() {
    val r = router()
    val pack = r.handle(dir.records[0], "POST", "/pce/pack", "{}")
    assertEquals(200, pack.status)
    assertEquals("NOT_FOUND", json(pack).getString("code"))
    // The service vanished mid-call: 503, and the lease is not stuck running.
    val act = r.handle(dir.records[0], "POST", "/pce/act", "{}")
    assertEquals(503, act.status)
    now += 30_000
    assertEquals(200, r.handle(dir.records[1], "POST", "/pce/observe", "{}").status)
  }
}
