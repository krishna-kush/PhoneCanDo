package com.phonecando.runner.checks.now

import com.phonecando.runner.checks.TurnEnd
import com.phonecando.runner.checks.now.CheckRun.Row
import com.phonecando.runner.checks.now.CheckRun.RowStatus
import com.phonecando.runner.checks.now.CheckRun.State
import com.phonecando.runner.checks.now.CheckRun.Step
import com.phonecando.runner.engine.EngineMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// A Check now run through its parts: rows queued, testing, answered by a
// verdict, unknown or skipped; a part ending as soon as its rows have
// answers, else a beat after its turn end; steps from each look, movement,
// a wait for you in its own app, done, stuck, cancelled, failed; news from
// before a part's start counts for nothing.
class CheckRunsTest {
  private var now = 1_000L
  private val runs = CheckRuns { now }

  private val task = CheckNowRules.TASK
  private val acpPart = CheckPlan.Part(EngineMode.ACP, task, newChat = true, tests = listOf("acp", "acpTools"))
  private val appPart = CheckPlan.Part(EngineMode.TERMINAL, task, newChat = false, tests = listOf("tools", "chat"))
  private val terminal = CheckPlan(listOf(CheckPlan.Part(EngineMode.TERMINAL, task, newChat = true, tests = listOf("tools", "task"))))
  private val twoParts = CheckPlan(listOf(acpPart, appPart))
  private val chatOnly = CheckPlan(
    listOf(acpPart, CheckPlan.Part(EngineMode.TERMINAL, null, newChat = false, tests = listOf("tools", "chat"), skips = listOf("messages"))),
  )

  private fun look(
    ready: Boolean = true,
    heard: Long = 0,
    reading: CheckRun.Reading? = null,
    asking: Boolean = false,
    viewer: Boolean = false,
  ) = CheckSample(engine = if (ready) "ready" else "starting", ready = ready, reading = reading, asking = asking, heard = heard, viewer = viewer)

  private fun tick(sample: CheckSample = look()): CheckRuns.Tick? = runs.tick(mapOf("a" to sample)).firstOrNull()

  private fun run(): CheckRun = checkNotNull(runs.get("a"))

  private fun status(id: String): RowStatus? = run().rows.firstOrNull { it.id == id }?.status

  private fun why(id: String): String? = run().rows.firstOrNull { it.id == id }?.why

  @Test fun beginsOnPartOneWithItsRowsTesting() {
    assertTrue(runs.begin("a", chatOnly))
    assertEquals(
      CheckRun(
        State.RUNNING, 1_000L, 1_000L, 1, 2, EngineMode.ACP, step = Step.STARTING,
        rows = listOf(
          Row("acp", 1, RowStatus.TESTING),
          Row("acpTools", 1, RowStatus.TESTING),
          Row("tools", 2, RowStatus.QUEUED),
          Row("chat", 2, RowStatus.QUEUED),
          Row("messages", 2, RowStatus.SKIPPED, CheckRunCopy.SKIPPED),
        ),
      ),
      runs.get("a"),
    )
    assertFalse(runs.begin("a", terminal))
    assertTrue(runs.begin("b", terminal))
    assertEquals(mapOf("a" to EngineMode.ACP, "b" to EngineMode.TERMINAL), runs.going())
    assertTrue(runs.active())
  }

  @Test fun aVerdictAnswersARowOfThePartRunningOnly() {
    runs.begin("a", twoParts)
    // Before its start was asked: the engine before it.
    assertFalse(runs.verdict("a", "acp", failed = false))
    runs.launched("a", 1)
    assertTrue(runs.verdict("a", "acp", failed = false))
    assertEquals(RowStatus.ANSWERED, status("acp"))
    // Again: no news, though the verdict is kept.
    assertFalse(runs.verdict("a", "acp", failed = true))
    assertTrue(run().rows.first { it.id == "acp" }.failed)
    // A row of a later part, or none of this check.
    assertFalse(runs.verdict("a", "tools", failed = false))
    assertEquals(RowStatus.QUEUED, status("tools"))
    assertFalse(runs.verdict("a", "wake", failed = false))
  }

  @Test fun aPartWithAllItsAnswersEndsAtOnce() {
    runs.begin("a", twoParts)
    runs.launched("a", 1)
    tick()
    runs.verdict("a", "acp", failed = false)
    runs.verdict("a", "acpTools", failed = true)
    now += 1_000
    // No turn end, no wait: part 2 starts.
    assertEquals(CheckRuns.Tick("a", true, CheckRuns.Action.Advance(2, appPart)), tick())
    assertEquals(2, run().part)
    assertEquals(EngineMode.TERMINAL, run().partMode)
    assertEquals(RowStatus.TESTING, status("tools"))
    assertEquals(RowStatus.TESTING, status("chat"))
    runs.launched("a", 2)
    runs.verdict("a", "tools", failed = false)
    now += 1_000
    assertNull(tick()?.action)
    runs.verdict("a", "chat", failed = false)
    now += 1_000
    assertEquals(CheckRuns.Action.Ended, tick()?.action)
    assertEquals(State.DONE, run().state)
    assertEquals(CheckRun.Tally(checked = 3, notWorking = 1, unknown = 0), run().tally())
  }

  @Test fun onePartIsDoneASecondPastGraceAfterItsTurnEnd() {
    runs.begin("a", terminal)
    now += 1_000
    // Its start not asked yet: starting, even with an engine ready.
    tick()
    assertEquals(Step.STARTING, run().step)
    runs.launched("a", 1)
    now += 1_000
    tick(look(ready = false))
    assertEquals(Step.STARTING, run().step)
    now += 1_000
    tick()
    assertEquals(Step.WORKING, run().step)
    runs.verdict("a", "tools", failed = false)
    assertFalse(runs.turnEnded("a", EngineMode.ACP))
    assertTrue(runs.turnEnded("a", EngineMode.TERMINAL))
    assertFalse(runs.turnEnded("a", EngineMode.TERMINAL))
    val doneAt = now + CheckRuns.DONE_MS
    now += 1_000
    tick()
    assertEquals(Step.CHECKING, run().step)
    now = doneAt - 1
    tick()
    assertEquals(State.RUNNING, run().state)
    now = doneAt
    assertEquals(CheckRuns.Tick("a", changed = true, action = CheckRuns.Action.Ended), tick())
    assertEquals(State.DONE, run().state)
    assertNull(run().step)
    assertEquals(RowStatus.ANSWERED, status("tools"))
    assertEquals(RowStatus.UNKNOWN, status("task"))
    assertEquals(CheckRunCopy.UNKNOWN_AFTER_TURN, why("task"))
    assertFalse(runs.active())
  }

  @Test fun aPartThatHoldsTheChatEndsOnlyOnceItsEngineIsReady() {
    val holder = CheckPlan.Part(EngineMode.ACP, task, newChat = true, holdsChat = true)
    runs.begin("a", CheckPlan(listOf(holder, appPart)))
    runs.launched("a", 1)
    assertNull(tick(look(ready = false))?.action)
    assertEquals(1, run().part)
    assertEquals(CheckRuns.Action.Advance(2, appPart), tick(look(ready = true))?.action)
  }

  @Test fun aFailedTurnEndsItsPartWithItsOwnReason() {
    runs.begin("a", twoParts)
    runs.launched("a", 1)
    tick()
    runs.verdict("a", "acp", failed = false)
    runs.verdict("a", "acpTools", failed = false)
    assertEquals(CheckRuns.Tick("a", true, CheckRuns.Action.Advance(2, appPart)), tick())
    runs.launched("a", 2)
    tick()
    assertTrue(runs.turnEnded("a", EngineMode.TERMINAL, TurnEnd.FAILED))
    now += CheckRuns.DONE_MS
    assertEquals(CheckRuns.Tick("a", changed = true, action = CheckRuns.Action.Ended), tick())
    assertEquals(State.DONE, run().state)
    assertEquals(RowStatus.UNKNOWN, status("tools"))
    assertEquals(CheckRunCopy.UNKNOWN_FAILED, why("tools"))
  }

  @Test fun aTurnYouStoppedEndsTheWholeCheck() {
    runs.begin("a", twoParts)
    runs.launched("a", 1)
    tick()
    runs.verdict("a", "acp", failed = false)
    // Your Stop on Home cancels its ACP turn: no own-app part follows.
    assertTrue(runs.turnEnded("a", EngineMode.ACP, TurnEnd.STOPPED))
    assertEquals(State.CANCELLED, run().state)
    assertEquals(CheckRunCopy.YOU_STOPPED, run().detail)
    assertNull(run().step)
    assertEquals(RowStatus.ANSWERED, status("acp"))
    assertEquals(CheckRunCopy.UNKNOWN_STOPPED, why("acpTools"))
    assertEquals(CheckRunCopy.UNKNOWN_NOT_REACHED, why("tools"))
    assertFalse(runs.active())
    now += CheckRuns.DONE_MS
    assertEquals(emptyList<CheckRuns.Tick>(), runs.tick(mapOf("a" to look())))
    // The same in its own app (an interrupt it reports).
    runs.begin("a", terminal)
    runs.launched("a", 1)
    assertTrue(runs.turnEnded("a", EngineMode.TERMINAL, TurnEnd.STOPPED))
    assertEquals(State.CANCELLED, run().state)
    assertEquals(CheckRunCopy.UNKNOWN_STOPPED, why("task"))
  }

  @Test fun theNotificationsStopInAcpModeEndsTheWholeCheck() {
    runs.begin("a", twoParts)
    runs.launched("a", 1)
    tick()
    // A stop of an engine in ACP mode fails its turn first, then the engine stops.
    assertTrue(runs.turnEnded("a", EngineMode.ACP, TurnEnd.FAILED))
    assertTrue(runs.engineEnded("a", failed = false, detail = null, liveNow = false))
    assertEquals(State.FAILED, run().state)
    assertEquals(CheckRunCopy.STOPPED, run().detail)
    assertEquals(CheckRunCopy.UNKNOWN_NOT_REACHED, why("tools"))
    assertFalse(runs.active())
  }

  @Test fun acpPartThenItsOwnAppAfterItsTurnEnd() {
    runs.begin("a", twoParts)
    runs.launched("a", 1)
    tick()
    runs.verdict("a", "acp", failed = false)
    assertTrue(runs.turnEnded("a", EngineMode.ACP))
    now += CheckRuns.DONE_MS
    assertEquals(CheckRuns.Tick("a", true, CheckRuns.Action.Advance(2, appPart)), tick())
    // Its turn end moved it (working to checking) on the same tick.
    assertEquals(now, run().movedAt)
    assertEquals(Step.STARTING, run().step)
    assertEquals(RowStatus.UNKNOWN, status("acpTools"))
    assertEquals(CheckRunCopy.UNKNOWN_AFTER_TURN, why("acpTools"))
    assertEquals(mapOf("a" to EngineMode.TERMINAL), runs.going())
    // The ACP engine we stop for part 2 is not its end; part 1's start counts no more.
    assertFalse(runs.engineEnded("a", failed = false, detail = null, liveNow = false))
    runs.launched("a", 1)
    assertFalse(runs.turnEnded("a", EngineMode.TERMINAL))
    runs.launched("a", 2)
    now += 1_000
    tick()
    assertEquals(Step.WORKING, run().step)
    assertTrue(runs.turnEnded("a", EngineMode.TERMINAL))
    now += CheckRuns.DONE_MS
    tick()
    assertEquals(State.DONE, run().state)
  }

  @Test fun aPartWithNoTaskEndsOnceTheChatItOpenedIsJudged() {
    runs.begin("a", chatOnly)
    runs.launched("a", 1)
    runs.turnEnded("a", EngineMode.ACP)
    now += CheckRuns.DONE_MS
    tick()
    runs.launched("a", 2)
    now += 1_000
    tick(look(ready = false))
    assertEquals(Step.STARTING, run().step)
    // No task: no turn end of its own.
    assertFalse(runs.turnEnded("a", EngineMode.TERMINAL))
    now += 1_000
    val readyAt = now
    tick()
    assertEquals(Step.CHECKING, run().step)
    runs.verdict("a", "chat", failed = false)
    now = readyAt + CheckRuns.CHAT_DONE_MS - 1
    tick()
    assertEquals(State.RUNNING, run().state)
    now = readyAt + CheckRuns.CHAT_DONE_MS
    tick()
    assertEquals(State.DONE, run().state)
    assertEquals(RowStatus.ANSWERED, status("chat"))
    assertEquals(CheckRunCopy.UNKNOWN_NO_TURN, why("tools"))
    assertEquals(RowStatus.SKIPPED, status("messages"))
    assertEquals(CheckRun.Tally(checked = 1, notWorking = 0, unknown = 3), run().tally())
  }

  @Test fun stepsFollowTheLook() {
    runs.begin("a", terminal)
    runs.launched("a", 1)
    tick(look(reading = CheckRun.Reading(420, 1_000)))
    assertEquals(Step.READING, run().step)
    assertEquals(CheckRun.Reading(420, 1_000), run().reading)
    now += 1_000
    tick(look(asking = true))
    assertEquals(Step.ANSWER, run().step)
    assertNull(run().reading)
    now += 1_000
    tick()
    assertEquals(Step.WORKING, run().step)
    // Leaving the question is a move.
    assertEquals(now, run().movedAt)
  }

  @Test fun movedAtMovesOnlyWhenTheLookChanges() {
    runs.begin("a", terminal)
    runs.launched("a", 1)
    now += 1_000
    assertEquals(CheckRuns.Tick("a", true, null), tick(look(heard = 1)))
    val moved = now
    assertEquals(moved, run().movedAt)
    now += 1_000
    // The same look: nothing to tell.
    assertNull(tick(look(heard = 1)))
    assertEquals(moved, run().movedAt)
    now += 1_000
    assertEquals(CheckRuns.Tick("a", true, null), tick(look(heard = 2)))
    assertEquals(now, run().movedAt)
  }

  @Test fun stuckWhenNothingMoves() {
    runs.begin("a", twoParts)
    runs.launched("a", 1)
    tick()
    val moved = now
    now = moved + CheckRuns.STUCK_MS - 1
    assertNull(tick())
    now = moved + CheckRuns.STUCK_MS
    assertEquals(CheckRuns.Tick("a", true, CheckRuns.Action.Ended), tick())
    assertEquals(State.STUCK, run().state)
    assertEquals(CheckRunCopy.stuck("working on the task", left = false), run().detail)
    assertNull(run().step)
    assertNull(runs.going()["a"])
    assertEquals(CheckRunCopy.UNKNOWN_CUT, why("acp"))
    assertEquals(CheckRunCopy.UNKNOWN_NOT_REACHED, why("tools"))
  }

  @Test fun inItsOwnAppNothingMovingIsAWaitForYouNotStuck() {
    runs.begin("a", terminal)
    runs.launched("a", 1)
    tick()
    val moved = now
    now = moved + CheckRuns.STALL_MS - 1
    assertNull(tick())
    assertEquals(Step.WORKING, run().step)
    now = moved + CheckRuns.STALL_MS
    assertEquals(CheckRuns.Tick("a", true, null), tick())
    assertEquals(Step.WAITING, run().step)
    // The wait is no move, and it is never stuck.
    assertEquals(moved, run().movedAt)
    now += CheckRuns.STUCK_MS * 2
    assertNull(tick())
    assertEquals(State.RUNNING, run().state)
    // A move ends the wait.
    now += 1_000
    assertEquals(CheckRuns.Tick("a", true, null), tick(look(heard = 1)))
    assertEquals(Step.WORKING, run().step)
    assertEquals(now, run().movedAt)
    now = 1_000L + CheckRuns.CHECK_MAX_MS
    assertEquals(CheckRuns.Tick("a", true, CheckRuns.Action.Ended), tick(look(heard = 1)))
    assertEquals(State.STUCK, run().state)
    assertEquals(CheckRunCopy.tooLong(left = false), run().detail)
  }

  @Test fun noWaitWhileItStartsOrInAcpMode() {
    // A TUI shows nothing to answer before it is ready.
    runs.begin("a", terminal)
    runs.launched("a", 1)
    tick(look(ready = false))
    now += CheckRuns.STALL_MS * 2
    tick(look(ready = false))
    assertEquals(Step.STARTING, run().step)
    // ACP mode has no screen of its own: no wait there.
    runs.begin("b", twoParts)
    runs.launched("b", 1)
    runs.tick(mapOf("b" to look()))
    now += CheckRuns.STALL_MS
    runs.tick(mapOf("b" to look()))
    assertEquals(Step.WORKING, runs.get("b")?.step)
  }

  @Test fun yourViewOfItsTerminalKeepsItMoving() {
    runs.begin("a", terminal)
    runs.launched("a", 1)
    tick(look(viewer = true))
    now += CheckRuns.STALL_MS * 2
    tick(look(viewer = true))
    assertEquals(Step.WORKING, run().step)
    assertEquals(now, run().movedAt)
    now = 1_000L + CheckRuns.CHECK_MAX_MS
    assertEquals(CheckRuns.Tick("a", true, CheckRuns.Action.Ended), tick(look(viewer = true)))
    assertEquals(CheckRunCopy.tooLong(left = true), run().detail)
  }


  @Test fun aQuestionWaitingHoldsTheStuckClockButNotTheLimit() {
    runs.begin("a", terminal)
    runs.launched("a", 1)
    tick(look(asking = true))
    now += CheckRuns.STUCK_MS * 2
    assertNull(tick(look(asking = true)))
    assertEquals(State.RUNNING, run().state)
    now = 1_000L + CheckRuns.CHECK_MAX_MS
    assertEquals(CheckRuns.Tick("a", true, CheckRuns.Action.Ended), tick(look(asking = true)))
    assertEquals(CheckRunCopy.tooLong(left = false), run().detail)
  }

  @Test fun failedWhenItsEngineEndsBeforeItsTurnEnd() {
    runs.begin("a", terminal)
    // Before its start was asked: the engine we stopped.
    assertFalse(runs.engineEnded("a", failed = true, detail = "x", liveNow = false))
    runs.launched("a", 1)
    // An older life's end while the new engine runs.
    assertFalse(runs.engineEnded("a", failed = false, detail = null, liveNow = true))
    assertTrue(runs.engineEnded("a", failed = true, detail = " sign in first ", liveNow = false))
    assertEquals(State.FAILED, run().state)
    assertEquals("sign in first", run().detail)
    assertNull(run().step)
    assertEquals(CheckRunCopy.UNKNOWN_CUT, why("task"))
    runs.begin("b", terminal)
    runs.launched("b", 1)
    runs.engineEnded("b", failed = true, detail = null, liveNow = false)
    assertEquals(CheckRunCopy.ENGINE_FAILED, runs.get("b")?.detail)
    runs.begin("c", terminal)
    runs.launched("c", 1)
    runs.engineEnded("c", failed = false, detail = null, liveNow = false)
    assertEquals(CheckRunCopy.STOPPED, runs.get("c")?.detail)
  }

  @Test fun anEngineEndAfterTheTurnEndKeepsItGoing() {
    runs.begin("a", terminal)
    runs.launched("a", 1)
    runs.turnEnded("a", EngineMode.TERMINAL)
    assertFalse(runs.engineEnded("a", failed = true, detail = "exit 0", liveNow = false))
    // After a finished turn, even a stop is not the check's end.
    assertFalse(runs.engineEnded("a", failed = false, detail = null, liveNow = false))
    now += CheckRuns.DONE_MS
    tick(look(ready = false))
    assertEquals(State.DONE, run().state)
    // A crash that failed its turn lets the part end as usual.
    runs.begin("a", twoParts)
    runs.launched("a", 1)
    runs.turnEnded("a", EngineMode.ACP, TurnEnd.FAILED)
    assertFalse(runs.engineEnded("a", failed = true, detail = "died", liveNow = false))
    now += CheckRuns.DONE_MS
    assertEquals(CheckRuns.Action.Advance(2, appPart), tick()?.action)
  }

  @Test fun aRefusedStartFails() {
    runs.begin("a", terminal)
    assertTrue(runs.refused("a", "Android said no"))
    assertEquals(State.FAILED, run().state)
    assertEquals("Android said no", run().detail)
    assertFalse(runs.refused("a", "again"))
    // The next check replaces it.
    now += 1
    assertTrue(runs.begin("a", terminal))
    assertEquals(1_001L, run().startedAt)
    assertEquals(RowStatus.TESTING, status("task"))
  }

  @Test fun cancelEndsARunGoing() {
    runs.begin("a", twoParts)
    assertTrue(runs.cancel("a"))
    assertEquals(State.CANCELLED, run().state)
    assertNull(run().detail)
    assertNull(run().step)
    assertEquals(RowStatus.UNKNOWN, status("acp"))
    assertEquals(CheckRunCopy.UNKNOWN_NOT_REACHED, why("chat"))
    assertFalse(runs.cancel("a"))
    assertFalse(runs.active())
    assertEquals(emptyList<CheckRuns.Tick>(), runs.tick(mapOf("a" to look())))
    assertFalse(runs.verdict("a", "acp", failed = false))
  }

  @Test fun aRunWithoutALookWaits() {
    runs.begin("a", terminal)
    now += CheckRuns.STUCK_MS
    assertEquals(emptyList<CheckRuns.Tick>(), runs.tick(emptyMap()))
    assertEquals(State.RUNNING, run().state)
  }

  @Test fun forgetDropsIt() {
    runs.begin("a", terminal)
    runs.forget("a")
    assertNull(runs.get("a"))
    assertFalse(runs.active())
  }

  @Test fun readingPercent() {
    assertEquals(42, CheckRun.Reading(420, 1_000).percent)
    assertEquals(100, CheckRun.Reading(2_000, 1_000).percent)
    assertNull(CheckRun.Reading(5, null).percent)
    assertNull(CheckRun.Reading(5, 0).percent)
  }

  @Test fun stuckCopyIsTheContracts() {
    assertEquals(
      "Nothing moved for 3 minutes (reading the task), so we stopped it to free memory. Open the agent: it may need you to sign in.",
      CheckRunCopy.stuck(Step.READING.words, left = false),
    )
    assertEquals("It ran for 30 minutes without finishing, so we stopped it to free memory.", CheckRunCopy.tooLong(left = false))
    assertTrue(CheckRunCopy.stuck("starting", left = true).contains("We left it open on your screen"))
    assertTrue(CheckRunCopy.tooLong(left = true).contains("We left it open on your screen."))
  }

  @Test fun mapIsWhatJsReads() {
    val reading = CheckRun(
      State.RUNNING, 5L, 7L, 1, 2, EngineMode.ACP, Step.READING, CheckRun.Reading(10, null),
      rows = listOf(Row("acp", 1, RowStatus.TESTING), Row("messages", 2, RowStatus.SKIPPED, "why", failed = true)),
    )
    assertEquals(
      mapOf(
        "state" to "running", "startedAt" to 5L, "movedAt" to 7L, "part" to 1, "parts" to 2, "partMode" to "acp",
        "step" to "reading", "reading" to mapOf("read" to 10L),
        "rows" to listOf(
          mapOf("id" to "acp", "part" to 1, "status" to "testing"),
          mapOf("id" to "messages", "part" to 2, "status" to "skipped", "why" to "why"),
        ),
      ),
      reading.toMap(),
    )
    val stuck = CheckRun(State.STUCK, 5L, 7L, 2, 2, EngineMode.TERMINAL, detail = "why")
    assertEquals(
      mapOf(
        "state" to "stuck", "startedAt" to 5L, "movedAt" to 7L, "part" to 2, "parts" to 2, "partMode" to "terminal",
        "detail" to "why", "rows" to emptyList<Any>(),
      ),
      stuck.toMap(),
    )
    // A reading shows only with its step; a step only while running.
    assertNull(CheckRun(State.RUNNING, 5L, 7L, 1, 1, EngineMode.TERMINAL, Step.WORKING, CheckRun.Reading(1, 2)).toMap()["reading"])
    assertNull(CheckRun(State.DONE, 5L, 7L, 1, 1, EngineMode.TERMINAL, Step.CHECKING).toMap()["step"])
  }
}
