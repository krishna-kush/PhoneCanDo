package com.phonecando.runner.bridge

import com.phonecando.runner.controllock.unlockedLock
import com.phonecando.runner.presence.FakeEffects
import com.phonecando.runner.presence.Focus
import com.phonecando.runner.presence.HandMode
import com.phonecando.runner.presence.HandsText
import com.phonecando.runner.presence.PresenceStore
import com.phonecando.runner.presence.StatusMood
import com.phonecando.runner.presence.UserAct
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

// The presence routes through the real router: a hand-over each way, the
// waits, status lines and focus, on the channels each lives on.
class PresenceRoutesTest {
  private var now = 0L
  private val fx = FakeEffects()
  private val store = PresenceStore({ now }, fx)
  private val lease = ScreenLease(30_000) { now }
  private val a1 = agent("a1", "opencode")
  private val a2 = agent("a2", "claude")
  private var facts = Focus.Facts(appShown = false, openAgent = null, interactive = true, locked = false)

  private fun router(full: Boolean = true, waitMs: Long = 200) = BridgeRouter(
    full = full,
    automation = { null },
    lock = unlockedLock { now },
    lease = lease,
    alive = { true },
    handlers = PresenceRoutes(store, { facts }, waitMs).table(),
    handOver = store::handOver,
  )

  private fun post(path: String, body: JSONObject = JSONObject(), caller: com.phonecando.runner.agents.AgentRecord = a1, full: Boolean = true) =
    router(full).handle(caller, "POST", path, body.toString())

  private fun data(reply: Reply): JSONObject {
    assertEquals(reply.body, 200, reply.status)
    return JSONObject(reply.body).getJSONObject("data")
  }

  private fun code(reply: Reply) = JSONObject(reply.body).getString("code")

  @Test fun aPrivateHandOverAnswersAtOnceAndPauses() {
    val reply = data(post("/hands/over", JSONObject().put("why", "type your password").put("private", true)))
    assertEquals("private", reply.getString("mode"))
    assertFalse(reply.getBoolean("back"))
    assertEquals(HandsText.HANDED_PRIVATE, reply.getString("message"))
    assertEquals(HandMode.PAUSED, store.handOver()!!.mode)
    assertEquals("type your password", store.handOver()!!.why)
    // It took the screen, and its time stands still (the lease's freeze).
    assertEquals("a1", lease.holderId())
    assertEquals(listOf("freeze a1"), fx.log)
    // Now nobody hands over again, and it may not drive.
    assertEquals("user_has_controls", code(post("/hands/over", JSONObject().put("why", "x"), a2)))
    assertEquals("paused_by_user", code(post("/hands/over", JSONObject().put("why", "x"))))
    // Waiting while stopped answers at once: end the turn.
    val wait = data(post("/hands/wait"))
    assertFalse(wait.getBoolean("back"))
    assertEquals("private", wait.getString("mode"))
  }

  @Test fun aWatchHandOverWaitsForYou() {
    // Nobody hands back: the call's time runs out.
    val timedOut = data(post("/hands/over", JSONObject().put("why", "pick the photo")))
    assertEquals("watch", timedOut.getString("mode"))
    assertFalse(timedOut.getBoolean("back"))
    val ranOut = data(post("/hands/wait", JSONObject().put("timeoutSec", 1)))
    assertFalse(ranOut.getBoolean("back"))
    assertEquals("watch", ranOut.getString("mode"))
    // It waits again rather than end its turn.
    assertEquals(HandsText.STILL_YOURS, ranOut.getString("message"))
    // Your turn while it waits: back, and no note.
    val pool = Executors.newSingleThreadExecutor()
    val waiting = pool.submit<Reply> { router(waitMs = 5_000).handle(a1, "POST", "/hands/wait", "{}") }
    Thread.sleep(100)
    assertTrue(store.user(UserAct.GIVE_BACK))
    assertTrue(data(waiting.get(2, TimeUnit.SECONDS)).getBoolean("back"))
    assertFalse(fx.log.any { it.startsWith("resume") })
    // No hand-over is its now: back at once.
    assertTrue(data(post("/hands/wait")).getBoolean("back"))
  }

  @Test fun handOverArguments() {
    assertEquals(400, post("/hands/over").status)
    assertEquals(400, post("/hands/over", JSONObject().put("why", "  \n ")).status)
    assertEquals(400, post("/hands/over", JSONObject().put("why", "x".repeat(121))).status)
    assertEquals(400, post("/hands/over", JSONObject().put("why", "ok").put("private", "yes")).status)
    assertEquals(400, post("/hands/wait", JSONObject().put("timeoutSec", "soon")).status)
    assertNull(store.handOver())
    // A line break in why becomes a space.
    data(post("/hands/over", JSONObject().put("why", "your\ncode").put("private", true)))
    assertEquals("your code", store.handOver()!!.why)
  }

  @Test fun theHandsAreFullOnly() {
    assertEquals(404, post("/hands/over", JSONObject().put("why", "x"), full = false).status)
    assertEquals(404, post("/hands/wait", full = false).status)
  }

  @Test fun anotherAgentsScreenIsBusyNotHandedOver() {
    // a2 drives: a1's hand-over joins the line instead.
    lease.done((lease.claim("a2", "claude", { true }) as ScreenLease.Granted).ticket)
    assertEquals("control_busy", code(post("/hands/over", JSONObject().put("why", "x"))))
    assertNull(store.handOver())
  }

  @Test fun statusOnEveryChannel() {
    for (full in listOf(true, false)) {
      assertTrue(data(post("/status", JSONObject().put("text", "Reading logs").put("mood", "thinking"), full = full)).getBoolean("shown"))
    }
    assertEquals(StatusMood.THINKING, store.statuses()["a1"]!!.mood)
    data(post("/status", JSONObject().put("text", "")))
    assertNull(store.statuses()["a1"])
    assertEquals(400, post("/status").status)
    assertEquals(400, post("/status", JSONObject().put("text", "x").put("mood", "sleepy")).status)
  }

  @Test fun focusSaysWhereTheUserLooks() {
    facts = Focus.Facts(appShown = true, openAgent = "a1", interactive = true, locked = false)
    val seen = data(post("/focus", full = false))
    assertEquals("front", seen.getString("app"))
    assertEquals("your_chat", seen.getString("onScreen"))
    assertEquals("unlocked", seen.getString("phone"))
    facts = facts.copy(appShown = false, interactive = false)
    val away = data(post("/focus", caller = a2))
    assertTrue(away.isNull("onScreen"))
    assertEquals("off", away.getString("phone"))
  }
}
