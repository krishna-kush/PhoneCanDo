package com.phonecando.runner.schedule

import com.phonecando.runner.schedule.FireRules.Action
import com.phonecando.runner.schedule.FireRules.Engine
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// Every row of the table a due task decides by.
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

  @Test fun otherwiseItAsks() {
    // A restart would end its jobs, or take the agent from under you.
    assertEquals(Action.ASK_USER, FireRules.decide(ready(tui.copy(chat = ChatMode.NEW, jobs = true))))
    assertEquals(Action.ASK_USER, FireRules.decide(ready(tui.copy(chat = ChatMode.NEW, appInFront = true))))
    // A hook kind whose hook is not waiting, and no prompt.
    assertEquals(Action.ASK_USER, FireRules.decide(ready(tui.copy(kindPrompts = false, wakeReady = false))))
    // A hook kind that wakes but takes no prompt, asked for a new chat.
    assertEquals(Action.ASK_USER, FireRules.decide(ready(tui.copy(kindPrompts = false, chat = ChatMode.NEW))))
  }
}
