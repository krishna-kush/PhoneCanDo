package com.phonecando.runner.bridge

import com.phonecando.runner.AutomationHost
import com.phonecando.runner.AutomationUnavailableException
import com.phonecando.runner.controllock.LockMode
import com.phonecando.runner.controllock.unlockedLock
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// The router's checks in order (route, flavor, lock, service, body, lease)
// and the envelopes they answer with, the screen line among them.
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
  private val dir = FakeDirectory(agent("a1", "opencode"), agent("a2", "opencode 2"), agent("a3", "claude"))
  private val yours = mutableListOf<String>()
  private val notices = object : ScreenNotices {
    override fun waiting(holderId: String, waiterName: String) = Unit

    override fun yours(agentId: String) {
      yours += agentId
    }
  }
  private val lease = ScreenLease(30_000, notices) { now }
  private val handled = mutableListOf<String>()
  private val echo: RouteHandler = { call ->
    handled += "${call.agent.id} ${call.route.path}"
    Reply.ok(JSONObject().put("route", call.route.path))
  }

  // What the user does while an /unlock dialog is up.
  private var atDialog: (BridgeCall) -> Unit = {}
  private val unlock: RouteHandler = { call ->
    handled += "${call.agent.id} ${call.route.path}"
    atDialog(call)
    Reply.ok(JSONObject().put("unlocked", lock.unlockedFor(call.agent.id)))
  }
  private val handlers: Map<Route, RouteHandler> =
    Route.entries.associateWith { echo } + PceRoutes { host }.table() + (Route.UNLOCK to unlock)

  // Agents whose current turn another agent's message started.
  private val agentTurns = mutableSetOf<String>()

  private fun router(full: Boolean = true) = BridgeRouter(
    full,
    { if (full) host else null },
    lock,
    lease,
    { dir.get(it) != null },
    handlers,
    startedByAgent = { it in agentTurns },
  )

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
    assertEquals(1, body.getInt("place"))
    assertEquals(
      "opencode holds the screen; you are #1 in line; we'll message you when it is yours",
      body.getString("message"),
    )
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

  // The screen line

  @Test fun waitersAreToldTheirPlaceAndTheReturnHandsTheScreenToTheFirst() {
    val r = router()
    r.handle(dir.records[0], "POST", "/pce/observe", "{}")
    assertEquals(1, json(r.handle(dir.records[1], "POST", "/pce/observe", "{}")).getInt("place"))
    assertEquals(2, json(r.handle(dir.records[2], "POST", "/open", "{}")).getInt("place"))
    assertEquals(200, r.handle(dir.records[0], "POST", "/app", "{}").status)
    assertEquals(listOf("a2"), yours)
    val third = json(r.handle(dir.records[2], "POST", "/pce/observe", "{}"))
    assertEquals("opencode 2", third.getString("holder"))
    assertEquals(1, third.getInt("place"))
    assertEquals(200, r.handle(dir.records[1], "POST", "/pce/observe", "{}").status)
  }

  @Test fun anAgentTurnGetsScreenRefused() {
    agentTurns += "a2"
    val r = router()
    val refused = r.handle(dir.records[1], "POST", "/pce/observe", "{}")
    assertEquals(409, refused.status)
    assertEquals("screen_refused", json(refused).getString("code"))
    assertEquals(
      "a turn another agent's message started can't take the screen; the user or your own earlier request in the queue can",
      json(refused).getString("message"),
    )
    assertNull(lease.holderId())
    // It never joins the line; calls that leave the screen alone still pass.
    r.handle(dir.records[0], "POST", "/pce/observe", "{}")
    assertEquals("screen_refused", json(r.handle(dir.records[1], "POST", "/open", "{}")).getString("code"))
    assertTrue(lease.line().waiting.isEmpty())
    assertEquals(200, r.handle(dir.records[1], "POST", "/clipboard", "{}").status)
  }

  @Test fun theReservedAgentPassesInAnAgentTurn() {
    val r = router()
    r.handle(dir.records[0], "POST", "/pce/observe", "{}")
    assertEquals(409, r.handle(dir.records[1], "POST", "/pce/observe", "{}").status)
    // The "yours" notice started its next turn.
    agentTurns += "a2"
    r.handle(dir.records[0], "POST", "/app", "{}")
    assertEquals(200, r.handle(dir.records[1], "POST", "/pce/observe", "{}").status)
    assertEquals(200, r.handle(dir.records[1], "POST", "/open", "{}").status)
  }

  @Test fun askModeALockedAgentWaitsInLineInsteadOfAsking() {
    lock.setMode(LockMode.ASK)
    lock.grantAsk("a1")
    val r = router()
    assertEquals(200, r.handle(dir.records[0], "POST", "/pce/observe", "{}").status)
    // Locked, while another drives: its place in line, not a 403...
    val waits = r.handle(dir.records[1], "POST", "/pce/observe", "{}")
    assertEquals(409, waits.status)
    assertEquals(1, json(waits).getInt("place"))
    // ...and its unlock waits too, at once and with no dialog over a1's app.
    val asks = r.handle(dir.records[1], "POST", "/unlock", "{}")
    assertEquals("control_busy", json(asks).getString("code"))
    assertEquals(1, json(asks).getInt("place"))
    assertTrue(handled.none { it == "a2 /unlock" })
    assertEquals("a1", lease.holderId())
  }

  @Test fun askModeTheFirstInLineStillNeedsItsUnlock() {
    lock.setMode(LockMode.ASK)
    lock.grantAsk("a1")
    val r = router()
    r.handle(dir.records[0], "POST", "/pce/observe", "{}")
    r.handle(dir.records[1], "POST", "/pce/observe", "{}")
    r.handle(dir.records[0], "POST", "/app", "{}")
    assertEquals(listOf("a2"), yours)
    // A place in line is never the screen, nor an unlock.
    assertEquals(403, r.handle(dir.records[1], "POST", "/pce/observe", "{}").status)
    assertNull(lease.holderId())
    // The user takes a minute over the fingerprint: the reservation waits.
    atDialog = {
      now += 60_000
      lease.tick { dir.get(it) != null }
      lock.grantAsk(it.agent.id)
    }
    assertEquals(true, json(r.handle(dir.records[1], "POST", "/unlock", "{}")).getJSONObject("data").getBoolean("unlocked"))
    now += 29_000
    lease.tick { dir.get(it) != null }
    assertEquals(200, r.handle(dir.records[1], "POST", "/pce/observe", "{}").status)
    assertEquals("a2", lease.holderId())
  }

  @Test fun anIgnoredUnlockDialogPassesTheScreenOn() {
    lock.setMode(LockMode.ASK)
    lock.grantAsk("a1")
    val r = router()
    r.handle(dir.records[0], "POST", "/pce/observe", "{}")
    r.handle(dir.records[1], "POST", "/pce/observe", "{}")
    r.handle(dir.records[2], "POST", "/pce/observe", "{}")
    r.handle(dir.records[0], "POST", "/app", "{}")
    // Nobody answers a2's dialog before its wait runs out.
    atDialog = { now += 45_000 }
    r.handle(dir.records[1], "POST", "/unlock", "{}")
    assertEquals(listOf("a2", "a3"), yours)
    assertEquals(ScreenLease.Seat("a3", "claude"), lease.line().holder)
  }

  @Test fun anUnlockDialogOnAFreeScreenKeepsOthersOff() {
    lock.setMode(LockMode.ASK)
    lock.grantAsk("a2")
    val r = router()
    var meanwhile: Reply? = null
    atDialog = { call ->
      meanwhile = r.handle(dir.records[1], "POST", "/pce/observe", "{}")
      lock.grantAsk(call.agent.id)
    }
    r.handle(dir.records[0], "POST", "/unlock", "{}")
    assertEquals(409, meanwhile?.status)
    assertEquals("opencode", JSONObject(meanwhile!!.body).getString("holder"))
    assertEquals(200, r.handle(dir.records[0], "POST", "/pce/observe", "{}").status)
    assertEquals("a1", lease.holderId())
  }

  @Test fun anUnlockedAgentsUnlockNeverWaits() {
    val r = router()
    r.handle(dir.records[0], "POST", "/pce/observe", "{}")
    // The gate is on for everyone: no dialog, so nothing to wait for.
    assertEquals(200, r.handle(dir.records[1], "POST", "/unlock", "{}").status)
    assertTrue(lease.line().waiting.isEmpty())
  }

  @Test fun anUnlockedAgentsUnlockLeavesTheLineAlone() {
    lock.setMode(LockMode.ASK)
    lock.grantAsk("a1")
    val r = router()
    // A free screen: no dialog opens, so nothing is reserved for it.
    r.handle(dir.records[0], "POST", "/unlock", "{}")
    assertEquals(ScreenLease.Line(null, reserved = false, emptyList()), lease.line())
    assertEquals(200, r.handle(dir.records[1], "POST", "/app", "{}").status)
    // Its own idle lease: no pause, so time still passes it on.
    lock.grantAsk("a2")
    r.handle(dir.records[1], "POST", "/pce/observe", "{}")
    r.handle(dir.records[2], "POST", "/app", "{}")
    atDialog = { now += 60_000 }
    r.handle(dir.records[1], "POST", "/unlock", "{}")
    lease.tick { dir.get(it) != null }
    assertEquals(listOf("a3"), yours)
  }
}
