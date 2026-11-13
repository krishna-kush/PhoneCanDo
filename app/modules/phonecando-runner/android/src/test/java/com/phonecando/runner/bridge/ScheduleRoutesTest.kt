package com.phonecando.runner.bridge

import com.phonecando.runner.schedule.ChatMode
import com.phonecando.runner.schedule.ScheduleBook
import com.phonecando.runner.schedule.ScheduleRules
import com.phonecando.runner.schedule.ScheduleStore
import com.phonecando.runner.schedule.SetBy
import com.phonecando.runner.schedule.StateFile
import com.phonecando.runner.schedule.Timing
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files
import java.time.DayOfWeek
import java.time.LocalDateTime
import java.time.ZoneId

// /schedule/* through the real router: on every channel with phone control
// locked, each way to say when, the chat defaults, every refusal, and an
// agent's list and cancel of its own.
class ScheduleRoutesTest {
  private val zone = ZoneId.of("Europe/Berlin")
  private val now = LocalDateTime.parse("2026-11-13T10:00").atZone(zone).toInstant().toEpochMilli()
  private val off = HashSet<String>()
  private val a1 = agent("a1", "Builder")
  private val a2 = agent("a2", "Tester")
  private var ids = 0
  private val book = ScheduleBook(
    store = ScheduleStore(StateFile(File(Files.createTempDirectory("routes").toFile(), "state/schedules.json"))),
    clock = { now },
    zone = { zone },
    newId = { "s" + (++ids).toString().padStart(10, '0') },
  )

  private fun router(full: Boolean) = BridgeRouter(
    full = full,
    automation = { null },
    lock = com.phonecando.runner.controllock.unlockedLock { 0L }.also { it.lock() },
    lease = ScreenLease(30_000) { 0L },
    alive = { true },
    handlers = ScheduleRoutes(book, { it !in off }, { now }, { zone }) { "at $it" }.table(),
  )

  private fun post(path: String, body: JSONObject, caller: com.phonecando.runner.agents.AgentRecord = a1, full: Boolean = true): Reply =
    router(full).handle(caller, "POST", path, body.toString())

  private fun add(body: JSONObject, caller: com.phonecando.runner.agents.AgentRecord = a1) = post("/schedule/add", body, caller)

  private fun data(reply: Reply): JSONObject {
    assertEquals(reply.body, 200, reply.status)
    return JSONObject(reply.body).getJSONObject("data")
  }

  private fun error(reply: Reply, status: Int, code: String): String {
    assertEquals(reply.body, status, reply.status)
    val body = JSONObject(reply.body)
    assertEquals(code, body.getString("code"))
    return body.getString("message")
  }

  private fun task(text: String = "check CI") = JSONObject().put("text", text)

  @Test fun inMinutesOnEveryChannelWithPhoneControlLocked() {
    for (full in listOf(true, false)) {
      val reply = data(post("/schedule/add", task().put("in", 30), full = full))
      assertEquals("2026-11-13T10:30:00+01:00", reply.getString("nextAt"))
      assertEquals("at ${now + 30 * ScheduleRules.MINUTE_MS}", reply.getString("nextAtText"))
      assertEquals("once at 2026-11-13 10:30", reply.getString("timing"))
      assertEquals("same", reply.getString("chat"))
      assertEquals("Europe/Berlin", reply.getString("zone"))
    }
    val s = book.all().first()
    assertEquals(SetBy.AGENT, s.by)
    assertEquals("a1", s.agentId)
  }

  @Test fun atIsTheLocalTimeUnlessItHasAnOffset() {
    assertEquals("2026-11-14T09:00:00+01:00", data(add(task().put("at", "2026-11-14T09:00"))).getString("nextAt"))
    assertEquals("2026-11-14T09:00:00+01:00", data(add(task().put("at", "2026-11-14 09:00"))).getString("nextAt"))
    assertEquals("2026-11-14T10:00:00+01:00", data(add(task().put("at", "2026-11-14T09:00:00Z"))).getString("nextAt"))
    assertEquals("2026-11-14T08:00:00+01:00", data(add(task().put("at", "2026-11-14T09:00+02:00"))).getString("nextAt"))
    error(add(task().put("at", "tomorrow")), 400, "bad_request")
    assertTrue(error(add(task().put("at", "2026-11-13T09:00")), 400, "bad_request").contains("past"))
    assertTrue(error(add(task().put("at", "2027-11-15T09:00")), 400, "bad_request").contains("366 days"))
  }

  @Test fun everyAndDailyRepeatInANewChatByDefault() {
    val every = data(add(task().put("every", 90)))
    assertEquals("every 1 h 30 min", every.getString("timing"))
    assertEquals("2026-11-13T11:30:00+01:00", every.getString("nextAt"))
    assertEquals("new", every.getString("chat"))
    val daily = data(add(task().put("daily", "9:00").put("days", JSONArray().put("mon").put("FRI")).put("chat", "same")))
    assertEquals("Mon, Fri at 09:00", daily.getString("timing"))
    // 2026-11-13 is a Friday, past 09:00: next Monday.
    assertEquals("2026-11-16T09:00:00+01:00", daily.getString("nextAt"))
    assertEquals("same", daily.getString("chat"))
    val s = book.all().last()
    assertEquals(Timing.Daily(9 * 60, setOf(DayOfWeek.MONDAY, DayOfWeek.FRIDAY)), s.timing)
    assertEquals(ChatMode.SAME, s.chat)
    assertEquals("daily at 18:30", data(add(task().put("daily", "18:30"))).getString("timing"))
  }

  @Test fun badArgumentsAre400() {
    error(add(JSONObject().put("in", 5)), 400, "bad_request")
    error(add(task(" ").put("in", 5)), 400, "bad_request")
    error(add(JSONObject().put("text", 3).put("in", 5)), 400, "bad_request")
    // Exactly one way to say when.
    error(add(task()), 400, "bad_request")
    error(add(task().put("in", 5).put("every", 30)), 400, "bad_request")
    error(add(task().put("in", 5).put("days", JSONArray().put("mon"))), 400, "bad_request")
    error(add(task().put("in", 0)), 400, "bad_request")
    error(add(task().put("in", 2.5)), 400, "bad_request")
    error(add(task().put("in", "5")), 400, "bad_request")
    error(add(task().put("in", ScheduleRules.MAX_MINUTES + 1)), 400, "bad_request")
    assertTrue(error(add(task().put("every", 14)), 400, "bad_request").contains("15"))
    error(add(task().put("daily", "25:00")), 400, "bad_request")
    error(add(task().put("daily", "09:00").put("days", JSONArray().put("someday"))), 400, "bad_request")
    error(add(task().put("daily", "09:00").put("days", "mon")), 400, "bad_request")
    error(add(task().put("in", 5).put("chat", "other")), 400, "bad_request")
    assertTrue(book.all().isEmpty())
  }

  @Test fun theUsersSwitchAndTheCapsRefuse() {
    off += "a1"
    assertEquals("the user switched off scheduling for you", error(add(task().put("in", 5)), 403, "not_allowed"))
    off.clear()
    repeat(ScheduleRules.MAX_BY_AGENT) { data(add(task("t$it").put("in", 5 + it))) }
    error(add(task().put("in", 5)), 409, "limit")
    data(add(task().put("in", 5), caller = a2))
  }

  @Test fun anAgentListsAndCancelsItsOwn() {
    val id = data(add(task().put("in", 30))).getString("id")
    val users = book.add("a1", ScheduleBook.Draft("deploy", Timing.Daily(8 * 60, emptySet())), SetBy.USER) as ScheduleBook.Result.Ok
    data(add(task("theirs").put("in", 30), caller = a2))
    val list = data(post("/schedule/list", JSONObject()))
    assertEquals("2026-11-13T10:00:00+01:00", list.getString("now"))
    assertEquals("Europe/Berlin", list.getString("zone"))
    val items = list.getJSONArray("schedules")
    assertEquals(2, items.length())
    val first = items.getJSONObject(0)
    assertEquals(id, first.getString("id"))
    assertEquals("check CI", first.getString("text"))
    assertEquals("agent", first.getString("by"))
    assertTrue(first.getBoolean("on"))
    assertEquals("user", items.getJSONObject(1).getString("by"))
    assertEquals("daily at 08:00", items.getJSONObject(1).getString("timing"))

    val message = error(post("/schedule/cancel", JSONObject().put("id", users.schedule.id)), 403, "not_allowed")
    assertTrue(message.contains("PhoneCanDo's Schedules"))
    error(post("/schedule/cancel", JSONObject().put("id", "s0000000003")), 404, "not_found")
    error(post("/schedule/cancel", JSONObject()), 400, "bad_request")
    val cancelled = data(post("/schedule/cancel", JSONObject().put("id", id)))
    assertEquals(id, cancelled.getString("id"))
    assertTrue(cancelled.getBoolean("cancelled"))
    assertNull(book.get(id))
    assertFalse(book.all().any { it.id == id })
  }
}
