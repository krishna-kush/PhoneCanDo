package com.phonecando.runner.schedule

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files
import java.time.DayOfWeek

// The schedules file and the runs log: every field round-trips, what does
// not read is left out, the runs keep the newest RUNS_KEPT and seq goes on.
class ScheduleStoreTest {
  private val dir: File = Files.createTempDirectory("schedules").toFile()
  private val file = File(dir, "state/schedules.json")

  private val schedules = listOf(
    Schedule(
      id = "sabcdefghij", agentId = "a1", text = "check CI\nthen fix it", timing = Timing.Once(1_700_000_000_000),
      chat = ChatMode.SAME, on = true, by = SetBy.AGENT, createdAt = 1_699_000_000_000, nextAt = 1_700_000_000_000, lastRun = null,
    ),
    Schedule(
      id = "s2222222222", agentId = "a1", text = "triage", timing = Timing.Every(90, 1_699_000_000_000),
      chat = ChatMode.NEW, on = false, by = SetBy.USER, createdAt = 5, nextAt = null,
      lastRun = LastRun(1_699_500_000_000, RunOutcome.ASKED, "it could not be woken"),
    ),
    Schedule(
      id = "s3333333333", agentId = "a2", text = "standup notes", timing = Timing.Daily(9 * 60 + 5, setOf(DayOfWeek.FRIDAY, DayOfWeek.MONDAY)),
      chat = ChatMode.NEW, on = true, by = SetBy.USER, createdAt = 6, nextAt = 1_700_100_000_000,
      lastRun = LastRun(1, RunOutcome.WOKE, null),
    ),
  )

  @Test fun schedulesAndWaitingFiringsRoundTrip() {
    val waiting = listOf(Waiting("sabcdefghij", 10, 11, true, 12), Waiting("s3333333333", 20, 21, false, 22, retryAt = 23))
    ScheduleStore(StateFile(file)).save(ScheduleStore.Saved(schedules, waiting))
    val loaded = ScheduleStore(StateFile(file)).load()
    assertEquals(schedules, loaded.schedules)
    assertEquals(waiting, loaded.waiting)
    // No temp file is left behind.
    assertEquals(listOf("schedules.json"), file.parentFile!!.list()!!.toList())
  }

  @Test fun theWireIsWhatJsAndTheToolsRead() {
    val daily = ScheduleJson.write(schedules[2])
    val timing = daily.getJSONObject("timing")
    assertEquals(setOf("type", "time", "days"), timing.keys().asSequence().toSet())
    assertEquals("daily", timing.getString("type"))
    assertEquals("09:05", timing.getString("time"))
    assertEquals("""["mon","fri"]""", timing.getJSONArray("days").toString())
    assertEquals("new", daily.getString("chat"))
    assertEquals("user", daily.getString("by"))
    val js = ScheduleJs.of(schedules[1])
    assertEquals(90.0, (js["timing"] as Map<*, *>)["minutes"])
    assertNull(js["nextAt"])
    assertEquals(mapOf("at" to 1_699_500_000_000.0, "outcome" to "asked", "detail" to "it could not be woken"), js["lastRun"])
  }

  @Test fun whatDoesNotReadIsLeftOut() {
    file.parentFile!!.mkdirs()
    val good = ScheduleJson.write(schedules[0])
    file.writeText(
      JSONObject()
        .put("schedules", org.json.JSONArray().put(good).put(JSONObject().put("id", "sx")).put(JSONObject(good.toString()).put("timing", JSONObject().put("type", "weekly"))))
        .put("waiting", org.json.JSONArray().put(JSONObject().put("scheduleId", "gone").put("until", 5)))
        .toString(),
    )
    val loaded = ScheduleStore(StateFile(file)).load()
    assertEquals(listOf(schedules[0]), loaded.schedules)
    assertTrue(loaded.waiting.isEmpty())
    file.writeText("not json")
    assertTrue(ScheduleStore(StateFile(file)).load().schedules.isEmpty())
  }

  @Test fun timingsFromTheApp() {
    val now = 1_000L
    assertEquals(Checked.Ok(Timing.Every(30, now)), ScheduleJson.timing(JSONObject().put("type", "every").put("minutes", 30.0), now))
    assertEquals(Checked.Ok(Timing.Daily(0, emptySet())), ScheduleJson.timing(JSONObject().put("type", "daily").put("time", "00:00"), null))
    assertTrue(ScheduleJson.timing(JSONObject().put("type", "daily").put("time", "24:00"), null) is Checked.Bad)
    assertTrue(ScheduleJson.timing(JSONObject().put("type", "daily").put("time", "09:00").put("days", org.json.JSONArray().put("mo")), null) is Checked.Bad)
    assertTrue(ScheduleJson.timing(JSONObject().put("type", "once").put("at", 1.5), null) is Checked.Bad)
    assertTrue(ScheduleJson.timing(JSONObject().put("type", "every").put("minutes", 30), null) is Checked.Bad)
  }

  @Test fun theRunsLogKeepsTheNewestAndCountsOn() {
    val log = File(dir, "state/schedule-runs.jsonl")
    val runs = ScheduleRuns(StateFile(log))
    fun add(i: Int) = runs.add { seq ->
      ScheduleRun(seq, "s$i", "a1", "Builder", "task $i", SetBy.USER, dueAt = i.toLong(), firedAt = i + 1L, late = i % 2 == 0, outcome = RunOutcome.STARTED)
    }
    repeat(ScheduleRules.RUNS_KEPT + 5) { add(it) }
    val first = runs.newest(1).single()
    assertEquals(ScheduleRules.RUNS_KEPT + 5L, first.seq)
    assertEquals(RunOutcome.FAILED, runs.update(first.seq, RunOutcome.FAILED, "the agent did not start")?.outcome)
    val again = ScheduleRuns(StateFile(log))
    assertEquals(ScheduleRules.RUNS_KEPT, again.newest(1000).size)
    assertEquals(first.copy(outcome = RunOutcome.FAILED, detail = "the agent did not start"), again.newest(1).single())
    assertEquals(6L, again.newest(1000).last().seq)
    assertEquals(ScheduleRules.RUNS_KEPT + 6L, again.add { first.copy(seq = it) }.seq)
    assertEquals(
      mapOf(
        "seq" to 206.0, "scheduleId" to first.scheduleId, "agentId" to "a1", "agentName" to "Builder", "text" to first.text,
        "by" to "user", "dueAt" to first.dueAt.toDouble(), "firedAt" to first.firedAt.toDouble(), "late" to first.late, "outcome" to "started",
      ),
      ScheduleJs.of(again.newest(1).single()),
    )
  }
}
