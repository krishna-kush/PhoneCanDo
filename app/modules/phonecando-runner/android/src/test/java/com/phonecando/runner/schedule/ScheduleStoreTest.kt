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

  @Test fun runsLeftOpenByAnEarlierProcessFail() {
    val log = File(dir, "state/schedule-runs.jsonl")
    val runs = ScheduleRuns(StateFile(log))
    fun add(id: String, outcome: RunOutcome, open: Boolean) = runs.add { seq ->
      ScheduleRun(seq, id, "a1", "Builder", "task", SetBy.USER, dueAt = 1, firedAt = 2, late = false, outcome = outcome, open = open)
    }
    val started = add("s1", RunOutcome.STARTED, open = true)
    val settled = add("s2", RunOutcome.WOKE, open = true)
    val older = add("s3", RunOutcome.STARTED, open = true)
    add("s3", RunOutcome.BUSY, open = false)
    val failed = add("s4", RunOutcome.STARTED, open = true)
    runs.settle(settled.seq)
    runs.update(failed.seq, RunOutcome.FAILED, "the agent did not start")
    // Only an open run says so, to the app too.
    assertEquals(true, ScheduleJs.of(runs.newest(5).last())["open"])
    assertNull(ScheduleJs.of(runs.newest(1).single())["open"])

    // The process died: the next one reads them back and fails what is still open.
    val again = ScheduleRuns(StateFile(log))
    val closed = again.closeOpen("PhoneCanDo was closed before the task finished")
    assertEquals(listOf(started.seq to true, older.seq to false), closed.map { (run, newest) -> run.seq to newest })
    val bySeq = ScheduleRuns(StateFile(log)).newest(10).associateBy { it.seq }
    assertEquals(RunOutcome.FAILED, bySeq.getValue(started.seq).outcome)
    assertEquals("PhoneCanDo was closed before the task finished", bySeq.getValue(started.seq).detail)
    assertEquals(RunOutcome.WOKE, bySeq.getValue(settled.seq).outcome)
    assertEquals("the agent did not start", bySeq.getValue(failed.seq).detail)
    assertTrue(bySeq.values.none { it.open })
    assertTrue(again.closeOpen("x").isEmpty())
  }

  @Test fun aRunHandedToItsOwnAppStaysOpenUntilItsStartEnds() {
    val runs = ScheduleRuns(StateFile(File(dir, "state/schedule-runs.jsonl")))
    val run = runs.add { seq ->
      ScheduleRun(seq, "s1", "a1", "Builder", "task", SetBy.USER, dueAt = 1, firedAt = 2, late = false, outcome = RunOutcome.STARTED, open = true)
    }
    // ACP mode did not start: its own app took the task, and the run goes on.
    val moved = runs.update(run.seq, RunOutcome.STARTED, "ACP mode did not start (x), so its own app took the task", open = true)
    assertEquals(true, moved?.open)
    assertEquals("ACP mode did not start (x), so its own app took the task", moved?.detail)
    runs.settle(run.seq)
    assertTrue(runs.newest(1).none { it.open })
  }

  @Test fun aRunCutOffAndBroughtBackStaysFailedWithWhen() {
    val log = File(dir, "state/schedule-runs.jsonl")
    val runs = ScheduleRuns(StateFile(log))
    fun add(agentId: String, open: Boolean) = runs.add { seq ->
      ScheduleRun(seq, "s1", agentId, "Builder", "task", SetBy.USER, dueAt = 1, firedAt = 2, late = false, outcome = RunOutcome.STARTED, open = open)
    }
    val going = add("a1", open = true)
    add("a2", open = true)
    add("a1", open = false)
    // The cut-off record names the run an agent's turn began as.
    assertEquals(going.seq, runs.openOf("a1"))
    assertNull(runs.openOf("a3"))
    // Or the run that set it working since its engine started (a terminal start, settled at ready).
    val asked = runs.add { seq ->
      ScheduleRun(seq, "s2", "a3", "Tester", "task", SetBy.USER, dueAt = 5, firedAt = 50, late = false, outcome = RunOutcome.ASKED)
    }
    val started = runs.add { seq ->
      ScheduleRun(seq, "s2", "a3", "Tester", "task", SetBy.USER, dueAt = 5, firedAt = 40, late = false, outcome = RunOutcome.STARTED)
    }
    assertEquals(started.seq, runs.setWorkingSince("a3", 40))
    assertNull(runs.setWorkingSince("a3", 41))
    assertTrue(asked.seq != runs.setWorkingSince("a3", 0))
    val again = ScheduleRuns(StateFile(log))
    again.closeOpen("PhoneCanDo was closed before the task finished")
    val noted = again.addNote(going.seq, "brought back at 10:42")
    assertEquals(RunOutcome.FAILED, noted?.outcome)
    assertEquals("PhoneCanDo was closed before the task finished; brought back at 10:42", noted?.detail)
    assertEquals(noted, ScheduleRuns(StateFile(log)).newest(10).single { it.seq == going.seq })
    assertNull(again.addNote(999, "brought back at 10:42"))
  }
}
