package com.phonecando.runner.schedule

import com.phonecando.runner.schedule.FireRules.Action
import com.phonecando.runner.schedule.FireRules.Engine
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Every row of the table a due task decides by, for kinds with and without an ACP mode.
class FireRulesTest {
  // A TUI kind that takes a start prompt and wakes through a hook.
  private val tui = FireRules.State(
    engine = Engine.STOPPED, idle = false, kindPrompts = true, kindWakes = true, wakesByServer = false,
    wakeReady = true, chat = ChatMode.SAME, jobs = false, appInFront = false,
  )

  // A server kind (opencode): no start prompt, wakes through its server.
  private val server = tui.copy(kindPrompts = false, wakesByServer = true)

  private fun ready(s: FireRules.State, idle: Boolean = true) = s.copy(engine = Engine.READY, idle = idle)

  @Test fun aKindWithNeitherPromptNorWakeIsUnsupported() {
    val none = tui.copy(kindPrompts = false, kindWakes = false)
    for (engine in Engine.entries) assertEquals(Action.UNSUPPORTED, FireRules.decide(none.copy(engine = engine, idle = true)))
    assertFalse(FireRules.kindRuns(kindPrompts = false, kindWakes = false))
    assertTrue(FireRules.kindRuns(kindPrompts = true, kindWakes = false))
    assertTrue(FireRules.kindRuns(kindPrompts = false, kindWakes = true))
  }

  @Test fun stoppedWithAStartPromptStartsWithIt() {
    assertEquals(Action.START_WITH_PROMPT, FireRules.decide(tui))
    assertEquals(Action.START_WITH_PROMPT, FireRules.decide(tui.copy(chat = ChatMode.NEW, kindWakes = false)))
  }

  @Test fun stoppedServerKindStartsThenWakes() {
    assertEquals(Action.START_THEN_WAKE, FireRules.decide(server))
    assertEquals(Action.START_THEN_WAKE, FireRules.decide(server.copy(chat = ChatMode.NEW)))
  }

  @Test fun stoppedHookKindWithoutPromptAsks() {
    assertEquals(Action.ASK_USER, FireRules.decide(tui.copy(kindPrompts = false)))
  }

  @Test fun startingStoppingOrBusyWaits() {
    assertEquals(Action.WAIT_IDLE, FireRules.decide(tui.copy(engine = Engine.STARTING)))
    assertEquals(Action.WAIT_IDLE, FireRules.decide(tui.copy(engine = Engine.STOPPING)))
    assertEquals(Action.WAIT_IDLE, FireRules.decide(ready(tui, idle = false)))
    assertEquals(Action.WAIT_IDLE, FireRules.decide(ready(server, idle = false)))
  }

  @Test fun idleAndWakeableWakesInTheSameChatOrAServerKindsNewOne() {
    assertEquals(Action.WAKE, FireRules.decide(ready(tui)))
    assertEquals(Action.WAKE, FireRules.decide(ready(server)))
    assertEquals(Action.WAKE, FireRules.decide(ready(server.copy(chat = ChatMode.NEW))))
    // Jobs and the app in front never stop a wake.
    assertEquals(Action.WAKE, FireRules.decide(ready(tui.copy(jobs = true, appInFront = true))))
  }

  @Test fun idleWithAPromptRestartsForANewChatOrWhenItCannotBeWoken() {
    assertEquals(Action.RESTART_WITH_PROMPT, FireRules.decide(ready(tui.copy(chat = ChatMode.NEW))))
    assertEquals(Action.RESTART_WITH_PROMPT, FireRules.decide(ready(tui.copy(wakeReady = false))))
    assertEquals(Action.RESTART_WITH_PROMPT, FireRules.decide(ready(tui.copy(kindWakes = false))))
  }

  // A TUI kind with an ACP mode (and a hook wake of its own).
  private val acp = tui.copy(acp = true)

  @Test fun anAcpKindRunsSchedulesWhateverElseItHas() {
    assertTrue(FireRules.kindRuns(kindPrompts = false, kindWakes = false, acp = true))
    val bare = acp.copy(kindPrompts = false, kindWakes = false)
    assertEquals(Action.START_ACP_WITH_PROMPT, FireRules.decide(bare))
  }

  @Test fun aStoppedAcpKindStartsInAcpModeWithTheTask() {
    assertEquals(Action.START_ACP_WITH_PROMPT, FireRules.decide(acp))
    assertEquals(Action.START_ACP_WITH_PROMPT, FireRules.decide(acp.copy(chat = ChatMode.NEW, appInFront = true, jobs = true)))
  }

  @Test fun anAcpKindStartingStoppingOrBusyWaits() {
    assertEquals(Action.WAIT_IDLE, FireRules.decide(acp.copy(engine = Engine.STARTING)))
    assertEquals(Action.WAIT_IDLE, FireRules.decide(acp.copy(engine = Engine.STOPPING)))
    assertEquals(Action.WAIT_IDLE, FireRules.decide(ready(acp.copy(mode = FireRules.Mode.ACP), idle = false)))
    assertEquals(Action.WAIT_IDLE, FireRules.decide(ready(acp, idle = false)))
  }

  @Test fun idleInAcpModeTakesTheTaskAsAPrompt() {
    val inAcp = ready(acp.copy(mode = FireRules.Mode.ACP))
    assertEquals(Action.PROMPT_ACP, FireRules.decide(inAcp))
    assertEquals(Action.PROMPT_ACP, FireRules.decide(inAcp.copy(chat = ChatMode.NEW, jobs = true, appInFront = true, viewer = true)))
  }

  @Test fun idleInTerminalModeSwitchesWhenNobodyWatchesElseItsHookTakesItElseAsks() {
    assertEquals(Action.SWITCH_TO_ACP_WITH_PROMPT, FireRules.decide(ready(acp)))
    assertEquals(Action.SWITCH_TO_ACP_WITH_PROMPT, FireRules.decide(ready(acp.copy(chat = ChatMode.NEW))))
    // Someone uses it, or it left jobs: its waiting hook takes the task in place.
    assertEquals(Action.WAKE, FireRules.decide(ready(acp.copy(viewer = true))))
    assertEquals(Action.WAKE, FireRules.decide(ready(acp.copy(jobs = true))))
    // No hook waiting, a new chat, or no hook wake at all: it asks.
    assertEquals(Action.ASK_USER, FireRules.decide(ready(acp.copy(viewer = true, wakeReady = false))))
    assertEquals(Action.ASK_USER, FireRules.decide(ready(acp.copy(viewer = true, chat = ChatMode.NEW))))
    assertEquals(Action.ASK_USER, FireRules.decide(ready(acp.copy(jobs = true, kindWakes = false))))
  }

  @Test fun theAppInFrontNeverKeepsAnAcpKindFromSwitching() {
    // Home shows an ACP run live; only its terminal on screen or its jobs hold it back.
    assertEquals(Action.SWITCH_TO_ACP_WITH_PROMPT, FireRules.decide(ready(acp.copy(appInFront = true))))
    assertEquals(Action.SWITCH_TO_ACP_WITH_PROMPT, FireRules.decide(ready(acp.copy(appInFront = true, chat = ChatMode.NEW))))
    // Cline as we saw it: ACP, no phone tools, no inbox, terminal idle, the Schedules page open.
    val cline = acp.copy(kindPrompts = false, kindWakes = false, readsNotices = false)
    assertEquals(Action.SWITCH_TO_ACP_WITH_PROMPT, FireRules.decide(ready(cline.copy(appInFront = true))))
    // The rows without an ACP mode keep it: a restart waits for the app to go.
    assertEquals(Action.ASK_USER, FireRules.decide(ready(tui.copy(chat = ChatMode.NEW, appInFront = true))))
  }

  @Test fun otherwiseItAsks() {
    // A restart would end its jobs, or take the agent from under you.
    assertEquals(Action.ASK_USER, FireRules.decide(ready(tui.copy(chat = ChatMode.NEW, jobs = true))))
    assertEquals(Action.ASK_USER, FireRules.decide(ready(tui.copy(chat = ChatMode.NEW, appInFront = true))))
    // A hook kind whose hook is not waiting, and no prompt.
    assertEquals(Action.ASK_USER, FireRules.decide(ready(tui.copy(kindPrompts = false, wakeReady = false))))
    // A hook kind that wakes but takes no prompt, asked for a new chat.
    assertEquals(Action.ASK_USER, FireRules.decide(ready(tui.copy(kindPrompts = false, chat = ChatMode.NEW))))
  }

  // ---- why it asks (AskReasons) ----

  @Test fun noReasonWhenItDoesNotAsk() {
    assertNull(AskReasons.of(tui))
    assertNull(AskReasons.of(ready(acp)))
    assertNull(AskReasons.of(ready(tui, idle = false)))
  }

  @Test fun anAcpKindSaysItsTerminalWasOpenOrItsJobs() {
    val watched = ready(acp.copy(viewer = true, wakeReady = false))
    assertEquals(AskReasons.TERMINAL_OPEN, AskReasons.of(watched))
    // Open on screen comes first.
    assertEquals(AskReasons.TERMINAL_OPEN, AskReasons.of(watched.copy(jobs = true, jobNames = listOf("npm run dev"))))
    val jobs = ready(acp.copy(jobs = true, kindWakes = false, jobNames = listOf("npm run dev")))
    assertEquals("it had jobs running: npm run dev", AskReasons.of(jobs))
    // Jobs with no names: it was kept running.
    assertEquals(AskReasons.KEPT_RUNNING, AskReasons.of(jobs.copy(jobNames = emptyList())))
  }

  @Test fun otherKindsSayWhichRowAsked() {
    assertEquals(AskReasons.NO_START_TASK, AskReasons.of(tui.copy(kindPrompts = false)))
    assertEquals(
      "it had jobs running: vite",
      AskReasons.of(ready(tui.copy(chat = ChatMode.NEW, jobs = true, jobNames = listOf("vite")))),
    )
    assertEquals(AskReasons.APP_OPEN, AskReasons.of(ready(tui.copy(chat = ChatMode.NEW, appInFront = true))))
    assertEquals(AskReasons.HOOK_NOT_WAITING, AskReasons.of(ready(tui.copy(kindPrompts = false, wakeReady = false))))
    assertEquals(AskReasons.NO_NEW_CHAT, AskReasons.of(ready(tui.copy(kindPrompts = false, chat = ChatMode.NEW))))
  }

  @Test fun jobNamesAreTrimmedDedupedAndCut() {
    assertEquals(
      "it had jobs running: a, b, c and 2 more",
      AskReasons.jobs(listOf("a", " b ", "a", "", "c", "d", "e")),
    )
    assertEquals(AskReasons.KEPT_RUNNING, AskReasons.jobs(listOf(" ")))
  }

  @Test fun aTapRunsTheTaskOnlyForAnAgentThatCannotReadItsNotice() {
    val cline = acp.copy(kindPrompts = false, kindWakes = false, readsNotices = false)
    assertTrue(AskReasons.tapRuns(cline))
    assertTrue(AskReasons.tapRuns(tui.copy(kindWakes = false, readsNotices = false)))
    // It reads the notice (phone tools or an inbox): the notice waits for its next turn.
    assertFalse(AskReasons.tapRuns(cline.copy(readsNotices = true)))
    // No way in for the task: nothing to tap.
    assertFalse(AskReasons.tapRuns(tui.copy(kindPrompts = false, readsNotices = false)))
  }
}
