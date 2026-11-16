package com.phonecando.runner.cutoff

import com.phonecando.runner.cutoff.CutOffRules.Busy
import com.phonecando.runner.cutoff.CutOffRules.Seen
import com.phonecando.runner.engine.EngineMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// JVM checks for what the record keeps: a ready engine's busy chats are its
// runs in this life, kept as they go; a stop ends them unless it keeps
// them; a death keeps them, marked; a settle drops them.
class CutOffRulesTest {
  private val life = "life2"

  private fun run(
    agentId: String = "a1",
    chatId: String? = null,
    life: String = this.life,
    mode: EngineMode = EngineMode.TERMINAL,
    seenAt: Long = 100,
  ) = CutOffRun(agentId, chatId, "fix the build", mode, seenAt, seenAt, life, 7)

  private fun sync(runs: List<CutOffRun>, seen: Seen, now: Long = 1_000, scheduleRun: Long? = null) =
    CutOffRules.sync(runs, seen, life, 7, now) { scheduleRun }

  @Test fun aBusyChatBecomesARunWithItsScheduledRun() {
    val runs = sync(emptyList(), Seen("a1", EngineMode.TERMINAL, listOf(Busy(null, "fix the build", false))), scheduleRun = 42)
    assertEquals(listOf(CutOffRun("a1", null, "fix the build", EngineMode.TERMINAL, 1_000, 1_000, life, 7, scheduleRun = 42)), runs)
  }

  @Test fun aBoardChangeKeepsTheRunAsItWasButItsTitle() {
    val first = sync(emptyList(), Seen("a1", EngineMode.TERMINAL, listOf(Busy(null, null, false))), now = 1_000)
    val soon = sync(first, Seen("a1", EngineMode.TERMINAL, listOf(Busy(null, "titled", false))), now = 2_000)
    assertEquals(first.single().copy(title = "titled"), soon.single())
    // A board change is no sign of work: seenAt stays.
    val later = sync(soon, Seen("a1", EngineMode.TERMINAL, listOf(Busy(null, null, false))), now = 9_000_000)
    assertEquals(soon, later)
  }

  @Test fun aRefreshTakesTheAgentsLastSignOfWork() {
    val runs = listOf(
      run(seenAt = 100),
      run(agentId = "a1", chatId = "old", life = "life1", seenAt = 100),
      run(agentId = "a1", chatId = "dead", seenAt = 100).copy(diedAt = 150),
      run(agentId = "a2", seenAt = 100),
    )
    val next = CutOffRules.refresh(runs, "a1", life, lastSign = 700, now = 900)
    assertEquals(run(seenAt = 100).copy(seenAt = 700, checkedAt = 900), next[0])
    assertEquals(runs.drop(1), next.drop(1))
    // A sign older than what it has, or none: only when it was looked at moves.
    assertEquals(run(seenAt = 100).copy(checkedAt = 900), CutOffRules.refresh(listOf(run(seenAt = 100)), "a1", life, 50, 900).single())
    assertEquals(run(seenAt = 100).copy(checkedAt = 900), CutOffRules.refresh(listOf(run(seenAt = 100)), "a1", life, null, 900).single())
  }

  @Test fun waitingChatsCountOnlyWhenNoneWorks() {
    // A subagent's question shows beside its working parent: only the parent is a run.
    val both = listOf(Busy("parent", null, false), Busy("child", null, true))
    assertEquals(listOf("parent"), sync(emptyList(), Seen("a1", EngineMode.TERMINAL, both)).map { it.chatId })
    val asking = listOf(Busy("s1", null, true))
    assertEquals(listOf("s1"), sync(emptyList(), Seen("a1", EngineMode.TERMINAL, asking)).map { it.chatId })
  }

  @Test fun anIdleReadyEngineHasNoRunsAndNoneFromOtherLives() {
    val runs = listOf(run(), run(life = "life1", chatId = "old"), run(agentId = "a2"))
    assertEquals(listOf("a2"), sync(runs, Seen("a1", EngineMode.TERMINAL, emptyList())).map { it.agentId })
  }

  @Test fun theRecordIsSortedSoAnUnchangedOneComparesEqual() {
    val runs = listOf(run(agentId = "b"), run(agentId = "a"))
    val once = sync(runs, Seen("b", EngineMode.TERMINAL, listOf(Busy(null, "fix the build", false))), now = 100)
    assertEquals(listOf("a", "b"), once.map { it.agentId })
    assertEquals(once, sync(once, Seen("b", EngineMode.TERMINAL, listOf(Busy(null, "fix the build", false))), now = 100))
  }

  @Test fun chatIdsAsTheRecordKeepsThem() {
    assertEquals("acp-chat", CutOffRules.chatId(EngineMode.ACP, "tui", "acp-chat"))
    assertNull(CutOffRules.chatId(EngineMode.TERMINAL, "tui", "acp-chat"))
    assertEquals("ses_1", CutOffRules.chatId(EngineMode.TERMINAL, "ses_1", null))
  }

  @Test fun aStopEndsTheRunsUnlessItKeepsThem() {
    val runs = listOf(run(), run(agentId = "a2"))
    assertEquals(listOf("a2"), CutOffRules.stopped(runs, "a1", null).map { it.agentId })
    val kept = CutOffRules.stopped(runs, "a1", Held.UPDATE)
    assertEquals(Held.UPDATE, kept.first { it.agentId == "a1" }.held)
    assertNull(kept.first { it.agentId == "a2" }.held)
  }

  @Test fun aDeathKeepsTheRunsMarkedOnce() {
    val died = CutOffRules.died(listOf(run()), "a1", 500)
    assertEquals(500L, died.single().diedAt)
    assertEquals(500L, CutOffRules.died(died, "a1", 900).single().diedAt)
  }

  @Test fun anExitRightAfterYouTypedIsYourQuit() {
    assertTrue(CutOffRules.quitByYou(10_000, 10_000 + CutOffRules.QUIT_WINDOW_MS))
    assertFalse(CutOffRules.quitByYou(10_000, 10_001 + CutOffRules.QUIT_WINDOW_MS))
    assertFalse(CutOffRules.quitByYou(null, 10_000))
    assertFalse(CutOffRules.quitByYou(10_001, 10_000))
  }

  @Test fun aRunBelongsToTheScheduledRunOpenElseTheOneThatStartedItsEngine() {
    var asked: Long? = null
    val since = { at: Long -> asked = at; 7L }
    assertEquals(3L, CutOffRules.scheduleRun(3, firstOfLife = true, lifeStartedAt = 1_000_000, setWorkingSince = since))
    assertNull(asked)
    // A terminal start settled at ready: the first run of that engine life is its task.
    assertEquals(7L, CutOffRules.scheduleRun(null, firstOfLife = true, lifeStartedAt = 1_000_000, setWorkingSince = since))
    assertEquals(1_000_000 - CutOffRules.START_SLACK_MS, asked)
    // A later run in the same life is the user's.
    assertNull(CutOffRules.scheduleRun(null, firstOfLife = false, lifeStartedAt = 1_000_000, setWorkingSince = since))
    assertNull(CutOffRules.scheduleRun(null, firstOfLife = true, lifeStartedAt = null, setWorkingSince = since))
  }

  @Test fun aCancelledUpdateDropsOnlyThisLifesKeptRuns() {
    val runs = listOf(
      run().copy(held = Held.UPDATE),
      run(agentId = "a2").copy(held = Held.SYSTEM),
      run(agentId = "a3", life = "life1").copy(held = Held.UPDATE),
      run(agentId = "a4"),
    )
    assertEquals(listOf("a2", "a3", "a4"), CutOffRules.unheld(runs, Held.UPDATE, life).map { it.agentId })
  }

  @Test fun goingOnDropsOnlyWhatWasCutOff() {
    val runs = listOf(run(chatId = "here"), run(chatId = "old", life = "life1"), run(chatId = "dead").copy(diedAt = 5), run(agentId = "a2", life = "life1"))
    val left = CutOffRules.wentOn(runs, "a1", life)
    assertEquals(listOf("here", null), left.map { it.chatId })
    assertTrue(CutOffRules.settled(runs, "a1").all { it.agentId == "a2" })
  }
}
