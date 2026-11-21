package com.phonecando.runner.bridge

import com.phonecando.runner.AutomationHost
import com.phonecando.runner.appaccess.AppGate
import com.phonecando.runner.appaccess.FakeAppAccessStore
import com.phonecando.runner.appaccess.ForeignParts
import com.phonecando.runner.appaccess.HOME
import com.phonecando.runner.appaccess.OWN
import com.phonecando.runner.appaccess.appAccess
import com.phonecando.runner.controllock.unlockedLock
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// The router's app-access gate: the app in front before the lease, the
// app a step inside the call reaches (AppGate), the app an observe or pack
// result names after it, "Just now" ending with phone_return, no taps on
// PhoneCanDo's own questions, and the screen line while the app question
// is up.
class BridgeRouterAppAccessTest {
  private class FakeHost : AutomationHost {
    // The app in front before a call, the one a step inside it reaches
    // (a tap's expect, a pack's flow), and the one its result names.
    var front: String? = null
    var inside: String? = null
    var shown: String? = null

    // A tap lands on a notification whose app no app's name matches.
    var tappedUnnamed: String? = null
    override val connected = true

    override fun describe() = JSONObject().put("ok", true)
    override fun observe(options: JSONObject, gate: AppGate?): JSONObject =
      step(gate) ?: JSONObject().put("ok", true).put("snapshotId", 7).putOpt("package", shown)
    override fun act(request: JSONObject, gate: AppGate?): JSONObject {
      val unnamed = tappedUnnamed?.let { ForeignParts.Part("r", ForeignParts.Kind.NOTIFICATION, emptyList(), it) }
      if (gate != null && unnamed != null && !gate.mayTap(unnamed)) return JSONObject().put("ok", false).put("code", "CANCELLED")
      return step(gate) ?: JSONObject().put("ok", true).put("snapshotId", 8)
    }
    override fun pack(request: JSONObject, gate: AppGate?): JSONObject = step(gate) ?: JSONObject().put("ok", true).putOpt("package", shown)
    override fun frontPackage() = front

    // As the PCE meets a refused step: an error of its own, no app named.
    private fun step(gate: AppGate?): JSONObject? =
      if (gate == null || gate.allows(inside)) null else JSONObject().put("ok", false).put("code", "CANCELLED").put("message", "stopped")
  }

  private val bank = "com.example.bank"
  private val host = FakeHost()
  private val store = FakeAppAccessStore()
  private val access = appAccess(store)
  private val dir = FakeDirectory(agent("a1", "opencode"), agent("a2", "claude"))
  private var now = 0L
  private val lease = ScreenLease(30_000, object : ScreenNotices {
    override fun waiting(holderId: String, waiterName: String) = Unit
    override fun yours(agentId: String) = Unit
  }) { now }
  private val echo: RouteHandler = { Reply.ok(JSONObject()) }

  // What the user does while the app question is up; whether it was shown.
  private var atQuestion: () -> Unit = {}
  private var asked = false
  private val question: RouteHandler = {
    asked = true
    atQuestion()
    Reply.ok(JSONObject())
  }
  private val handlers: Map<Route, RouteHandler> =
    Route.entries.associateWith { echo } + PceRoutes { host }.table() + (Route.APP_ACCESS to question)

  // The user has a question to answer in PhoneCanDo.
  private var deciding = false

  // The app a /open link would go to.
  private var linkApp: String? = null

  private fun router(full: Boolean = true) = BridgeRouter(
    full,
    { host },
    unlockedLock(),
    lease,
    { dir.get(it) != null },
    handlers,
    appAccess = access,
    ownPackage = OWN,
    questionWaiting = { deciding },
    linkHandler = { linkApp },
  )

  private fun launch(pkg: String) = JSONObject()
    .put("snapshotId", 1)
    .put("action", JSONObject().put("type", "launch").put("packageName", pkg))
    .toString()

  private fun json(reply: Reply) = JSONObject(reply.body)

  @Test fun anAppNobodyAnsweredForIsRefusedBeforeTheLease() {
    host.front = bank
    for (path in listOf("/pce/observe", "/pce/act", "/pce/pack")) {
      val reply = router().handle(dir.records[0], "POST", path, "{}")
      assertEquals(403, reply.status)
      val body = json(reply)
      assertEquals("app_not_allowed", body.getString("code"))
      assertEquals(bank, body.getString("package"))
      assertEquals("Name of $bank", body.getString("label"))
      assertTrue(body.getString("message").contains("phone_ask_app with package \"$bank\""))
    }
    assertNull(lease.holderId())
    // Not a PCE screen route: no app check.
    assertEquals(200, router().handle(dir.records[0], "GET", "/pce/describe", "").status)
    assertEquals(200, router().handle(dir.records[0], "POST", "/open", "{}").status)
  }

  @Test fun aBlockedAppSaysSoEvenUnderAllowAll() {
    access.block(bank)
    access.setAllowAll(true)
    host.front = bank
    val reply = router().handle(dir.records[0], "POST", "/pce/observe", "{}")
    assertEquals(403, reply.status)
    assertEquals("app_blocked", json(reply).getString("code"))
    assertTrue(json(reply).getString("message").contains("phone_hand_over"))
    assertNull(lease.holderId())
  }

  @Test fun allowedAppsAndTheHomeScreenGoThrough() {
    host.front = HOME
    host.shown = HOME
    assertEquals(200, router().handle(dir.records[0], "POST", "/pce/observe", "{}").status)
    host.front = bank
    host.shown = bank
    access.grantOnce("a1", bank)
    val reply = router().handle(dir.records[0], "POST", "/pce/observe", "{}")
    assertEquals(7, json(reply).getJSONObject("data").getInt("snapshotId"))
    // Its Just now is its own.
    assertEquals(403, router().handle(dir.records[1], "POST", "/pce/observe", "{}").status)
  }

  @Test fun aResultThatShowsAnotherAppIsDropped() {
    host.front = HOME
    host.shown = bank
    val observed = router().handle(dir.records[0], "POST", "/pce/observe", "{}")
    assertEquals(403, observed.status)
    assertEquals("app_not_allowed", json(observed).getString("code"))
    assertFalse(observed.body.contains("snapshotId"))
    val packed = router().handle(dir.records[0], "POST", "/pce/pack", "{}")
    assertEquals("app_not_allowed", json(packed).getString("code"))
    // A result that names no app passes.
    host.shown = null
    assertEquals(200, router().handle(dir.records[0], "POST", "/pce/observe", "{}").status)
  }

  @Test fun aStepInsideTheCallIsJudgedByTheAppItReaches() {
    // The icon tapped on the home screen, the wait on what it opened.
    host.front = HOME
    host.inside = bank
    for (path in listOf("/pce/observe", "/pce/act", "/pce/pack")) {
      val reply = router().handle(dir.records[0], "POST", path, "{}")
      assertEquals(403, reply.status)
      assertEquals("app_not_allowed", json(reply).getString("code"))
      assertEquals(bank, json(reply).getString("package"))
    }
    access.block(bank)
    assertEquals("app_blocked", json(router().handle(dir.records[0], "POST", "/pce/act", "{}")).getString("code"))
    // Allowed for this agent: the call goes on.
    access.forget(bank)
    access.grantOnce("a1", bank)
    assertEquals(200, router().handle(dir.records[0], "POST", "/pce/act", "{}").status)
  }

  @Test fun aTapOnANotificationNobodyCanNameSaysSo() {
    host.front = HOME
    host.tappedUnnamed = "Shell"
    val reply = router().handle(dir.records[0], "POST", "/pce/act", "{}")
    assertEquals(403, reply.status)
    assertEquals("notification_hidden", json(reply).getString("code"))
    assertEquals("Shell", json(reply).getString("label"))
  }

  @Test fun noFrontPackagePassesToTheResultCheck() {
    host.front = null
    host.shown = null
    assertEquals(200, router().handle(dir.records[0], "POST", "/pce/act", "{}").status)
  }

  @Test fun handingThePhoneBackEndsJustNow() {
    host.front = bank
    access.grantOnce("a1", bank)
    access.grantOnce("a2", bank)
    val r = router()
    assertEquals(200, r.handle(dir.records[0], "POST", "/pce/act", "{}").status)
    assertEquals(200, r.handle(dir.records[0], "POST", "/app", "{}").status)
    assertEquals(403, r.handle(dir.records[0], "POST", "/pce/act", "{}").status)
    // The other agent keeps its own until it hands the phone back.
    assertEquals(200, r.handle(dir.records[1], "POST", "/pce/act", "{}").status)
  }

  @Test fun noTapsOnPhoneCanDosOwnQuestions() {
    host.front = OWN
    host.shown = OWN
    deciding = true
    for (path in listOf("/pce/act", "/pce/pack")) {
      val reply = router().handle(dir.records[0], "POST", path, "{}")
      assertEquals(409, reply.status)
      assertEquals("user_deciding", json(reply).getString("code"))
    }
    assertNull(lease.holderId())
    // Looking stays allowed, and so does a tap once the question is gone.
    assertEquals(200, router().handle(dir.records[0], "POST", "/pce/observe", "{}").status)
    deciding = false
    assertEquals(200, router().handle(dir.records[0], "POST", "/pce/act", "{}").status)
    // Another app in front: a question in PhoneCanDo does not stop the tap.
    deciding = true
    host.front = HOME
    assertEquals(200, router().handle(dir.records[0], "POST", "/pce/act", "{}").status)
  }

  @Test fun theAppQuestionStopsTheAskersTimeAndAYesKeepsTheScreen() {
    host.front = HOME
    host.shown = HOME
    val r = router()
    assertEquals(200, r.handle(dir.records[0], "POST", "/pce/observe", "{}").status)
    atQuestion = {
      now += 60_000
      access.grantOnce("a1", bank)
    }
    assertEquals(200, r.handle(dir.records[0], "POST", "/app-access", """{"package":"$bank"}""").status)
    // Its time stood still while the user decided, and the yes started it over.
    assertEquals("a1", lease.holderId())
    assertEquals("control_busy", json(r.handle(dir.records[1], "POST", "/pce/observe", "{}")).getString("code"))
  }

  @Test fun aNoToTheAppQuestionPassesTheScreenOn() {
    host.front = HOME
    host.shown = HOME
    val r = router()
    r.handle(dir.records[0], "POST", "/pce/observe", "{}")
    atQuestion = { access.block(bank) }
    r.handle(dir.records[0], "POST", "/app-access", """{"package":"$bank"}""")
    assertNull(lease.holderId())
    assertEquals(200, r.handle(dir.records[1], "POST", "/pce/observe", "{}").status)
  }

  @Test fun theAppQuestionWaitsInLineWhileAnotherAgentHasTheScreen() {
    host.front = HOME
    host.shown = HOME
    val r = router()
    r.handle(dir.records[1], "POST", "/pce/observe", "{}")
    val reply = r.handle(dir.records[0], "POST", "/app-access", """{"package":"$bank"}""")
    assertEquals(409, reply.status)
    assertEquals("control_busy", json(reply).getString("code"))
    assertFalse(asked)
    // An app it may use already: no question, so nothing to wait for.
    access.grantOnce("a1", bank)
    assertEquals(200, r.handle(dir.records[0], "POST", "/app-access", """{"package":"$bank"}""").status)
    assertTrue(asked)
  }

  @Test fun liteHasNoAppChecks() {
    host.front = bank
    assertEquals(404, router(full = false).handle(dir.records[0], "POST", "/pce/observe", "{}").status)
    assertEquals(404, router(full = false).handle(dir.records[0], "POST", "/app-access", "{}").status)
  }

  @Test fun aLaunchFromPhoneCanDoAsksAboutTheAppItOpens() {
    // Asked from the chat: PhoneCanDo is in front and never asked about.
    host.front = OWN
    val reply = router().handle(dir.records[0], "POST", "/pce/act", launch(bank))
    assertEquals(403, reply.status)
    assertEquals("app_not_allowed", json(reply).getString("code"))
    assertEquals(bank, json(reply).getString("package"))
    assertNull(lease.holderId())
    // Once it may, the launch goes through, whatever is in front.
    access.grantOnce("a1", bank)
    host.front = "com.example.unasked"
    assertEquals(200, router().handle(dir.records[0], "POST", "/pce/act", launch(bank)).status)
    // A launch of PhoneCanDo itself never asks (the same agent: it holds the screen now).
    assertEquals(200, router().handle(dir.records[0], "POST", "/pce/act", launch(OWN)).status)
  }

  @Test fun aLaunchOfABlockedAppIsRefused() {
    access.block(bank)
    host.front = OWN
    val reply = router().handle(dir.records[0], "POST", "/pce/act", launch(bank))
    assertEquals("app_blocked", json(reply).getString("code"))
  }

  @Test fun aLinkAsksAboutTheAppAndroidHandsItTo() {
    host.front = OWN
    linkApp = bank
    val reply = router().handle(dir.records[0], "POST", "/open", "{\"url\":\"https://wa.me/1\"}")
    assertEquals(403, reply.status)
    assertEquals(bank, json(reply).getString("package"))
    // Android can't say (its chooser, or an app hidden from us): the first look inside asks.
    linkApp = null
    assertEquals(200, router().handle(dir.records[0], "POST", "/open", "{\"url\":\"https://wa.me/1\"}").status)
  }
}
